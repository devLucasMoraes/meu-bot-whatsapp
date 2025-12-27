import { Boom } from "@hapi/boom";
import makeWASocket, { DisconnectReason, jidNormalizedUser } from "baileys";
import qrcode from "qrcode-terminal";
import { In } from "typeorm";
import { AppDataSource } from "./database/dataSource.js";
import { AuthSession } from "./database/entities/AuthSession.entity.js";
import { Contact } from "./database/entities/Contact.entity.js";
import { Message } from "./database/entities/Message.entity.js";
import { Queue } from "./database/entities/Queue.entity.js";
import { Ticket, TicketStatus } from "./database/entities/Ticket.entity.js";
import { WhatsappInstance } from "./database/entities/WhatsappInstance.entity.js";
import { usePostgresAuthState } from "./services/authService.js";

export async function startBot(instance: WhatsappInstance) {
  console.log(
    `🤖 Iniciando bot: ${instance.name} (Tenant: ${instance.tenantId})`
  );

  // Repositórios
  const authRepo = AppDataSource.getRepository(AuthSession);
  const whatsappRepo = AppDataSource.getRepository(WhatsappInstance);
  const contactRepo = AppDataSource.getRepository(Contact);
  const ticketRepo = AppDataSource.getRepository(Ticket);
  const messageRepo = AppDataSource.getRepository(Message);
  const queueRepo = AppDataSource.getRepository(Queue);

  // 1. Carregar Auth State usando o ID da instância como sessionId
  const { state, saveCreds } = await usePostgresAuthState(
    authRepo,
    instance.id
  );

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // Vamos controlar isso manualmente
    defaultQueryTimeoutMs: 60000,
  });

  // 2. Gerenciar Conexão
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📲 Escaneie o QR Code no terminal:");
      qrcode.generate(qr, { small: true });

      // Atualizar status no banco
      await whatsappRepo.update(instance.id, {
        qrcode: qr,
        status: "QRCODE",
      });
    }

    if (connection === "open") {
      console.log(`✅ ${instance.name} Conectado!`);
      await whatsappRepo.update(instance.id, {
        status: "CONNECTED",
        qrcode: "",
      });
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log(`❌ Conexão fechada. Reconectando: ${shouldReconnect}`);

      await whatsappRepo.update(instance.id, { status: "DISCONNECTED" });

      if (shouldReconnect) {
        startBot(instance);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // 3. Processar Mensagens (Fluxo de Negócio)
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];

    if (!msg.key.fromMe && m.type === "notify" && msg.key.remoteJid) {
      const remoteJid = jidNormalizedUser(msg.key.remoteJid);

      // A. Buscar ou Criar Contato
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

      // B. Buscar Ticket Aberto
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

      // Se não tem ticket ou o anterior estava fechado, criar novo
      if (!ticket || ticket.status === TicketStatus.CLOSED) {
        ticket = ticketRepo.create({
          contact,
          whatsapp: instance,
          tenant: { id: instance.tenantId },
          status: TicketStatus.PENDING,
        });
        await ticketRepo.save(ticket);

        // Enviar Menu Inicial
        const menu =
          "Olá! Bem-vindo à Empresa Demo.\nEscolha uma opção:\n1 - Comercial\n2 - Suporte";
        await sock.sendMessage(remoteJid, { text: menu });
        return; // Para processamento aqui, espera a próxima msg do user
      }

      // C. Lógica de Roteamento (Ticket PENDING)
      if (ticket.status === TicketStatus.PENDING) {
        const body =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          "";

        // Buscar filas do tenant
        const queues = await queueRepo.findBy({ tenantId: instance.tenantId });
        // Simulação simples de escolha (1 = index 0, 2 = index 1)
        const choice = parseInt(body.trim());

        if (!isNaN(choice) && choice > 0 && choice <= queues.length) {
          const selectedQueue = queues[choice - 1];

          ticket.queue = selectedQueue;
          ticket.status = TicketStatus.OPEN; // Move para fila, aguardando user aceitar
          await ticketRepo.save(ticket);

          await sock.sendMessage(remoteJid, {
            text: `Entendido! ${selectedQueue.greetingMessage}\nAguarde um momento.`,
          });
        } else {
          await sock.sendMessage(remoteJid, {
            text: "Opção inválida. Digite 1 ou 2.",
          });
        }
      }

      // D. Salvar Mensagem no Banco (Histórico)
      const messageData = messageRepo.create({
        body:
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          "Mídia",
        type: "text",
        fromMe: false,
        ticket,
      });
      await messageRepo.save(messageData);

      console.log(
        `📩 Mensagem processada para Ticket ${ticket.id} na fila ${
          ticket.queue?.name || "Sem Fila"
        }`
      );
    }
  });
}
