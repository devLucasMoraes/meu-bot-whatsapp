import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Contact } from "../../database/entities/contact.entity.js";
import { Queue } from "../../database/entities/queue.entity.js";
import { Ticket, TicketStatus } from "../../database/entities/ticket.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { WhatsappInstance } from "../../database/entities/whatsappInstance.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function createTicket(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      "/tickets",
      {
        schema: {
          tags: ["tickets"],
          summary: "Abrir novo ticket",
          security: [{ bearerAuth: [] }],
          body: z.object({
            contactId: z.string().uuid(),
            queueId: z.string().uuid().optional(),
            whatsappId: z.string().uuid(),
          }),
        },
      },
      async (req, res) => {
        const userId = await req.getCurrentUserId();
        const { contactId, queueId, whatsappId } = req.body;

        const db = req.server.db.dataSource;
        const userRepo = db.getRepository(User);
        const ticketRepo = db.getRepository(Ticket);
        const contactRepo = db.getRepository(Contact);
        const whatsappRepo = db.getRepository(WhatsappInstance);

        const currentUser = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!currentUser || !currentUser.tenant) {
          throw new UnauthorizedError("Sessão inválida.");
        }

        // 1. Validar Contato e WhatsApp
        const contact = await contactRepo.findOne({
          where: { id: contactId, tenantId: currentUser.tenant.id },
        });
        if (!contact) throw new BadRequestError("Contato não encontrado.");

        const whatsapp = await whatsappRepo.findOne({
          where: { id: whatsappId, tenantId: currentUser.tenant.id },
        });
        if (!whatsapp)
          throw new BadRequestError("Instância WhatsApp não encontrada.");

        // 2. Verificar se já existe ticket aberto
        // CORREÇÃO: Usar a relação 'contact: { id: ... }' pois 'contactId' não é uma propriedade direta da classe Ticket
        const openTicket = await ticketRepo.findOne({
          where: {
            contact: { id: contactId },
            tenantId: currentUser.tenant.id,
            status: TicketStatus.OPEN,
          },
          relations: ["contact", "queue", "user", "whatsapp"],
        });

        if (openTicket) {
          return res.status(200).send(openTicket);
        }

        // 3. Criar Ticket
        // Usamos cast 'as any' ou referência parcial de objeto para as relações
        const ticket = ticketRepo.create({
          contact: contact,
          whatsapp: whatsapp,
          queue: queueId ? ({ id: queueId } as Queue) : null,
          tenantId: currentUser.tenant.id,
          status: TicketStatus.OPEN,
          user: { id: userId } as User, // Atribuir a quem abriu
        });

        await ticketRepo.save(ticket);

        // Recarrega para devolver completo
        const createdTicket = await ticketRepo.findOne({
          where: { id: ticket.id },
          relations: ["contact", "queue", "user", "whatsapp"],
        });

        return res.status(201).send(createdTicket);
      }
    );
}
