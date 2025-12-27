import { Boom } from "@hapi/boom";
import makeWASocket, { DisconnectReason, WASocket } from "baileys";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { AuthSession } from "../database/entities/AuthSession.entity.js";
import { WhatsappInstance } from "../database/entities/WhatsappInstance.entity.js";
import { usePostgresAuthState } from "../services/authService.js";
import { handleIncomingMessage } from "../services/wbotMessageListener.js";

// Tipagem para o Fastify reconhecer o plugin
declare module "fastify" {
  interface FastifyInstance {
    whatsapp: {
      instances: Map<string, WASocket>;
      start: (instance: WhatsappInstance) => Promise<WASocket>;
      stop: (id: string) => Promise<void>;
      restart: (instance: WhatsappInstance) => Promise<WASocket>;
    };
  }
}

const whatsappPlugin: FastifyPluginAsync = async (fastify) => {
  const connectedInstances = new Map<string, WASocket>();

  // --- Função Principal: Start Bot ---
  const start = async (instance: WhatsappInstance): Promise<WASocket> => {
    fastify.log.info(`🤖 Iniciando instância: ${instance.name}`);

    // Nota: Certifique-se que seu typeorm-plugin exporta { dataSource: DataSource }
    const db = fastify.db.dataSource;

    const authRepo = db.getRepository(AuthSession);
    const whatsappRepo = db.getRepository(WhatsappInstance);

    const { state, saveCreds } = await usePostgresAuthState(
      authRepo,
      instance.id
    );

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      defaultQueryTimeoutMs: 60000,
      logger: fastify.log.child({ module: "baileys" }),
    });

    connectedInstances.set(instance.id, sock);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        await whatsappRepo.update(instance.id, {
          qrcode: qr,
          status: "QRCODE",
        });

        if (fastify.io) {
          fastify.io
            .to(`tenant:${instance.tenantId}`)
            .emit(`instance:${instance.id}:qrcode`, { qrcode: qr });

          fastify.log.info(
            `📡 QR Code emitido para tenant ${instance.tenantId} (Instância: ${instance.name})`
          );
        }
      }

      if (connection === "open") {
        fastify.log.info(`✅ ${instance.name} Conectado!`);
        await whatsappRepo.update(instance.id, {
          status: "CONNECTED",
          qrcode: "",
        });
        if (fastify.io) {
          fastify.io
            .to(`tenant:${instance.tenantId}`)
            .emit(`instance:${instance.id}:status`, { status: "CONNECTED" });
        }
      }

      if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        if (shouldReconnect) {
          // Reconexão padrão (internet caiu, restart do server, etc)
          start(instance);
        } else {
          // CORREÇÃO APLICADA AQUI: Logout intencional ou sessão inválida
          fastify.log.warn(
            `⚠️ Instância ${instance.name} desconectada (Logout). Limpando sessão...`
          );

          // 1. Limpa as credenciais do banco para evitar conflito na próxima conexão
          await authRepo.delete({ sessionId: instance.id });

          // 2. Atualiza status para DISCONNECTED e limpa o QR Code antigo
          await whatsappRepo.update(instance.id, {
            status: "DISCONNECTED",
            qrcode: "",
          });

          connectedInstances.delete(instance.id);

          if (fastify.io) {
            fastify.io
              .to(`tenant:${instance.tenantId}`)
              .emit(`instance:${instance.id}:status`, {
                status: "DISCONNECTED",
              });
          }
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m) => {
      await handleIncomingMessage(fastify, instance, sock, m);
    });

    return sock;
  };

  const stop = async (id: string) => {
    const sock = connectedInstances.get(id);
    if (sock) {
      sock.end(undefined);
      connectedInstances.delete(id);
      const repo = fastify.db.dataSource.getRepository(WhatsappInstance);
      await repo.update(id, { status: "DISCONNECTED" });
    }
  };

  const restart = async (instance: WhatsappInstance) => {
    await stop(instance.id);
    return start(instance);
  };

  fastify.decorate("whatsapp", {
    instances: connectedInstances,
    start,
    stop,
    restart,
  });

  fastify.addHook("onReady", async () => {
    if (fastify.db.dataSource.isInitialized) {
      const repo = fastify.db.dataSource.getRepository(WhatsappInstance);
      const instances = await repo.find();
      fastify.log.info(`🔄 Restaurando ${instances.length} instâncias...`);

      for (const ins of instances) {
        start(ins).catch((err) =>
          fastify.log.error(`Erro ao restaurar ${ins.name}: ${err}`)
        );
      }
    }
  });

  fastify.addHook("onClose", async () => {
    fastify.log.info("🛑 Fechando conexões do WhatsApp...");
    for (const sock of connectedInstances.values()) {
      sock.end(undefined);
    }
    connectedInstances.clear();
  });
};

export default fp(whatsappPlugin, {
  name: "whatsapp-plugin",
  dependencies: ["typeorm-plugin"],
});
