import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Ticket } from "../../database/entities/ticket.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function getTicket(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/tickets/:id",
      {
        schema: {
          tags: ["tickets"],
          summary: "Obter detalhes do ticket",
          security: [{ bearerAuth: [] }],
          params: z.object({
            id: z.string().uuid(),
          }),
        },
      },
      async (req, res) => {
        const userId = await req.getCurrentUserId();
        const { id } = req.params;

        const userRepo = req.server.db.dataSource.getRepository(User);
        const ticketRepo = req.server.db.dataSource.getRepository(Ticket);

        const currentUser = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!currentUser || !currentUser.tenant) {
          throw new UnauthorizedError("Sessão inválida.");
        }

        const ticket = await ticketRepo.findOne({
          where: { id, tenantId: currentUser.tenant.id },
          relations: ["contact", "queue", "user", "whatsapp"],
        });

        if (!ticket) {
          throw new BadRequestError("Ticket não encontrado.");
        }

        return res.send(ticket);
      }
    );
}
