import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  jidNormalizedUser,
  WASocket,
} from "baileys";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { In } from "typeorm";
import { AuthSession } from "../database/entities/AuthSession.entity.js";
import { Contact } from "../database/entities/Contact.entity.js";
import { Message } from "../database/entities/Message.entity.js";
import { Queue } from "../database/entities/Queue.entity.js";
import { Ticket, TicketStatus } from "../database/entities/Ticket.entity.js";
import { WhatsappInstance } from "../database/entities/WhatsappInstance.entity.js";
import { usePostgresAuthState } from "../services/authService.js";

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
    // Se o seu plugin exporta o DataSource direto, remova o .dataSource aqui.
    const db = fastify.db.dataSource;

    const authRepo = db.getRepository(AuthSession);
    const whatsappRepo = db.getRepository(WhatsappInstance);
    const contactRepo = db.getRepository(Contact);
    const ticketRepo = db.getRepository(Ticket);
    const messageRepo = db.getRepository(Message);
    const queueRepo = db.getRepository(Queue);

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
          fastify.io.emit(`instance:${instance.id}:qrcode`, { qrcode: qr });
          fastify.log.info(`📡 QR Code emitido para ${instance.name}`);
        }
      }

      if (connection === "open") {
        fastify.log.info(`✅ ${instance.name} Conectado!`);
        await whatsappRepo.update(instance.id, {
          status: "CONNECTED",
          qrcode: "",
        });
        if (fastify.io)
          fastify.io.emit(`instance:${instance.id}:status`, {
            status: "CONNECTED",
          });
      }

      if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        if (shouldReconnect) {
          start(instance);
        } else {
          await whatsappRepo.update(instance.id, { status: "DISCONNECTED" });
          connectedInstances.delete(instance.id);
          if (fastify.io)
            fastify.io.emit(`instance:${instance.id}:status`, {
              status: "DISCONNECTED",
            });
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m) => {
      const msg = m.messages[0];

      if (!msg.key.fromMe && m.type === "notify" && msg.key.remoteJid) {
        const remoteJid = jidNormalizedUser(msg.key.remoteJid);

        try {
          let contact = await contactRepo.findOneBy({
            number: remoteJid,
            tenantId: instance.tenantId,
          });

          if (!contact) {
            contact = contactRepo.create({
              number: remoteJid,
              name: msg.pushName || "Desconhecido",
              tenantId: instance.tenantId,
            });
            await contactRepo.save(contact);
          }

          let ticket = await ticketRepo.findOne({
            where: {
              contact: { id: contact.id },
              tenant: { id: instance.tenantId },
              status: In([
                TicketStatus.PENDING,
                TicketStatus.OPEN,
                TicketStatus.IN_PROGRESS,
              ]),
            },
            relations: ["queue"],
          });

          if (!ticket || ticket.status === TicketStatus.CLOSED) {
            ticket = ticketRepo.create({
              contact,
              whatsapp: instance,
              tenant: { id: instance.tenantId },
              status: TicketStatus.PENDING,
            });
            await ticketRepo.save(ticket);

            const menu =
              "Olá! Bem-vindo à Empresa Demo.\nEscolha uma opção:\n1 - Comercial\n2 - Suporte";
            await sock.sendMessage(remoteJid, { text: menu });
          }

          if (ticket.status === TicketStatus.PENDING) {
            const body =
              msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              "";

            const queues = await queueRepo.findBy({
              tenantId: instance.tenantId,
            });

            const choice = parseInt(body.trim());

            if (!isNaN(choice) && choice > 0 && choice <= queues.length) {
              const selectedQueue = queues[choice - 1];

              ticket.queue = selectedQueue;
              ticket.status = TicketStatus.OPEN;
              await ticketRepo.save(ticket);

              await sock.sendMessage(remoteJid, {
                text: `Entendido! ${selectedQueue.greetingMessage}\nAguarde um momento.`,
              });
            }
          }

          const messageData = messageRepo.create({
            body:
              msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              "Mídia/Outros",
            type: "text",
            fromMe: false,
            ticket,
          });
          await messageRepo.save(messageData);

          fastify.log.info(
            // Alterado para usar logger do fastify
            `📩 Msg salva. Ticket: ${ticket.id} | Fila: ${
              ticket.queue?.name || "Nenhuma"
            }`
          );
        } catch (err) {
          fastify.log.error(err, "Erro ao processar mensagem");
        }
      }
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
    // CORREÇÃO 2: Iterar apenas sobre os valores (sockets) para não ter variável 'id' sobrando
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
