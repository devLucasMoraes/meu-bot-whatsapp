import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Message } from "../../database/entities/message.entity.js";
import { Ticket } from "../../database/entities/ticket.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function listTicketMessages(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/tickets/:id/messages",
      {
        schema: {
          tags: ["tickets"],
          summary: "Listar mensagens do ticket",
          params: z.object({ id: z.string().uuid() }),
          querystring: z.object({
            page: z.coerce.number().default(1),
            limit: z.coerce.number().default(20),
          }),
        },
      },
      async (req, res) => {
        const { id } = req.params;
        const { page, limit } = req.query;
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
        });

        if (!ticket) throw new BadRequestError("Ticket não encontrado.");

        const [messages, count] = await messageRepo.findAndCount({
          where: { ticket: { id: ticket.id } },
          order: { createdAt: "ASC" },
          skip: (page - 1) * limit,
          take: limit,
        });

        return res.send({
          data: messages,
          meta: { page, limit, total: count },
        });
      }
    );
}
