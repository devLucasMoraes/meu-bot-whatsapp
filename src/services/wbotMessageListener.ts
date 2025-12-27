import { Mutex } from "async-mutex"; // Importação nova
import { jidNormalizedUser, proto, WASocket } from "baileys";
import { FastifyInstance } from "fastify";
import { In } from "typeorm";
import { Contact } from "../database/entities/Contact.entity.js";
import { Message } from "../database/entities/Message.entity.js";
import { Queue } from "../database/entities/Queue.entity.js";
import { Ticket, TicketStatus } from "../database/entities/Ticket.entity.js";
import { WhatsappInstance } from "../database/entities/WhatsappInstance.entity.js";

// Armazena um Mutex para cada contato/número
const contactMutexes = new Map<string, Mutex>();

// Função para obter ou criar o Mutex de um contato
const getContactMutex = (contactId: string): Mutex => {
  if (!contactMutexes.has(contactId)) {
    contactMutexes.set(contactId, new Mutex());
  }
  return contactMutexes.get(contactId)!;
};

// Helper para extrair o texto
const getBodyMessage = (msg: proto.IWebMessageInfo): string => {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    ""
  );
};

export const handleIncomingMessage = async (
  fastify: FastifyInstance,
  instance: WhatsappInstance,
  sock: WASocket,
  m: { messages: proto.IWebMessageInfo[]; type: string }
) => {
  const msg = m.messages[0];
  const { dataSource } = fastify.db;

  const contactRepo = dataSource.getRepository(Contact);
  const ticketRepo = dataSource.getRepository(Ticket);
  const messageRepo = dataSource.getRepository(Message);
  const queueRepo = dataSource.getRepository(Queue);

  if (msg.key && !msg.key.fromMe && m.type === "notify" && msg.key.remoteJid) {
    const remoteJid = jidNormalizedUser(msg.key.remoteJid);

    // Obtém o "cadeado" específico para este número
    const mutex = getContactMutex(remoteJid);

    // INÍCIO DA ZONA CRÍTICA:
    // O runExclusive garante que apenas uma execução ocorra por vez para este número
    await mutex.runExclusive(async () => {
      try {
        // 1. Localizar ou Criar Contato
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

        // 2. Localizar Ticket Aberto
        // Graças ao Mutex, se duas mensagens chegarem juntas, a segunda vai esperar
        // a primeira terminar e criar o ticket. Quando a segunda rodar, ela JÁ vai encontrar o ticket criado.
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

        // 3. Se não houver ticket, criar um novo e enviar Menu
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

        // 4. Lógica de Fila (Se estiver pendente)
        if (ticket.status === TicketStatus.PENDING) {
          const body = getBodyMessage(msg);
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

        // 5. Salvar Mensagem no Histórico
        const messageData = messageRepo.create({
          body: getBodyMessage(msg) || "Mídia/Outros",
          type: "text",
          fromMe: false,
          ticket,
        });
        await messageRepo.save(messageData);

        fastify.log.info(
          `📩 Msg salva. Ticket: ${ticket.id} | Fila: ${
            ticket.queue?.name || "Nenhuma"
          }`
        );
      } catch (err) {
        fastify.log.error(err, "Erro ao processar mensagem");
      }
    });
    // FIM DA ZONA CRÍTICA
  }
};
