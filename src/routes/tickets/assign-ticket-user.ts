import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Ticket } from "../../database/entities/ticket.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function assignTicketUser(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      "/tickets/:id/assign",
      {
        schema: {
          tags: ["tickets"],
          summary: "Atribuir ticket a um usuário",
          params: z.object({ id: z.string().uuid() }),
          body: z.object({ userId: z.string().uuid().nullable() }),
        },
      },
      async (req, res) => {
        const { id } = req.params;
        const { userId: assignToUserId } = req.body;
        const currentUserId = await req.getCurrentUserId();

        const db = req.server.db.dataSource;
        const ticketRepo = db.getRepository(Ticket);
        const userRepo = db.getRepository(User);

        const currentUser = await userRepo.findOne({
          where: { id: currentUserId },
          relations: ["tenant"],
        });

        if (!currentUser?.tenant)
          throw new UnauthorizedError("Sessão inválida.");

        const ticket = await ticketRepo.findOne({
          where: { id, tenantId: currentUser.tenant.id },
        });

        if (!ticket) throw new BadRequestError("Ticket não encontrado.");

        if (assignToUserId) {
          // Validação: O usuário alvo existe e é do mesmo tenant?
          const userToAssign = await userRepo.findOne({
            where: { id: assignToUserId, tenantId: currentUser.tenant.id },
          });

          if (!userToAssign) {
            throw new BadRequestError(
              "Usuário alvo não encontrado nesta organização."
            );
          }
          ticket.user = userToAssign;
        } else {
          // Remover atribuição (null)
          ticket.user = null;
        }

        await ticketRepo.save(ticket);

        return res.send(ticket);
      }
    );
}
