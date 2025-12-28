import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Queue } from "../../database/entities/queue.entity.js";
import { Ticket } from "../../database/entities/ticket.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function transferTicketQueue(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      "/tickets/:id/queue",
      {
        schema: {
          tags: ["tickets"],
          summary: "Transferir ticket de fila",
          params: z.object({ id: z.string().uuid() }),
          body: z.object({ queueId: z.string().uuid() }),
        },
      },
      async (req, res) => {
        const { id } = req.params;
        const { queueId } = req.body;
        const userId = await req.getCurrentUserId();

        const db = req.server.db.dataSource;
        const ticketRepo = db.getRepository(Ticket);
        const queueRepo = db.getRepository(Queue);
        const userRepo = db.getRepository(User);

        const currentUser = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!currentUser?.tenant)
          throw new UnauthorizedError("Sessão inválida.");

        const ticket = await ticketRepo.findOne({
          where: { id, tenantId: currentUser.tenant.id },
          relations: ["queue"],
        });

        if (!ticket) throw new BadRequestError("Ticket não encontrado.");

        // Validação: A fila de destino pertence ao meu Tenant?
        const queue = await queueRepo.findOne({
          where: { id: queueId, tenantId: currentUser.tenant.id },
        });

        if (!queue) {
          throw new BadRequestError(
            "Fila não encontrada ou não pertence a esta organização."
          );
        }

        ticket.queue = queue;
        await ticketRepo.save(ticket);

        return res.send(ticket);
      }
    );
}
