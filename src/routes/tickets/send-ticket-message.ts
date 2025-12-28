import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Message } from "../../database/entities/message.entity.js";
import { Ticket } from "../../database/entities/ticket.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function sendTicketMessage(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      "/tickets/:id/messages",
      {
        schema: {
          tags: ["tickets"],
          summary: "Enviar mensagem no ticket",
          params: z.object({ id: z.string().uuid() }),
          body: z.object({
            body: z.string(),
            mediaUrl: z.string().optional(),
            type: z.string().default("text"),
          }),
        },
      },
      async (req, res) => {
        const { id } = req.params;
        const { body, mediaUrl, type } = req.body;
        const userId = await req.getCurrentUserId();

        const db = req.server.db.dataSource;
        const userRepo = db.getRepository(User);
        const ticketRepo = db.getRepository(Ticket);
        const messageRepo = db.getRepository(Message);

        const currentUser = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!currentUser?.tenant)
          throw new UnauthorizedError("Sessão inválida.");

        const ticket = await ticketRepo.findOne({
          where: { id, tenantId: currentUser.tenant.id },
          relations: ["whatsapp", "contact"],
        });

        if (!ticket) throw new BadRequestError("Ticket não encontrado.");
        if (!ticket.whatsapp)
          throw new BadRequestError("Ticket sem conexão WhatsApp definida.");

        const wbot = app.whatsapp.instances.get(ticket.whatsapp.id);
        if (!wbot) {
          throw new BadRequestError(
            "WhatsApp desconectado ou não inicializado."
          );
        }

        const jid = `${ticket.contact.number}@s.whatsapp.net`;

        try {
          if (mediaUrl) {
            // Lógica de envio de mídia baseada no tipo ou padrão imagem
            if (type === "video") {
              await wbot.sendMessage(jid, {
                video: { url: mediaUrl },
                caption: body,
              });
            } else if (type === "audio" || type === "voice") {
              await wbot.sendMessage(jid, {
                audio: { url: mediaUrl },
                ptt: type === "voice",
              });
            } else {
              // Default para imagem
              await wbot.sendMessage(jid, {
                image: { url: mediaUrl },
                caption: body,
              });
            }
          } else {
            // Apenas texto
            await wbot.sendMessage(jid, { text: body });
          }
        } catch (err) {
          req.log.error(err);
          throw new BadRequestError("Falha ao enviar mensagem no WhatsApp.");
        }

        const message = messageRepo.create({
          body,
          mediaUrl,
          type: type || "text",
          fromMe: true,
          read: true,
          ticket,
        });

        await messageRepo.save(message);

        return res.status(201).send(message);
      }
    );
}
