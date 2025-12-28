import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Ticket, TicketStatus } from "../../database/entities/ticket.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function updateTicketStatus(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      "/tickets/:id/status",
      {
        schema: {
          tags: ["tickets"],
          summary: "Atualizar status do ticket",
          params: z.object({ id: z.string().uuid() }),
          body: z.object({ status: z.nativeEnum(TicketStatus) }),
        },
      },
      async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        const userId = await req.getCurrentUserId();

        const db = req.server.db.dataSource;
        const ticketRepo = db.getRepository(Ticket);
        const userRepo = db.getRepository(User);

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

        ticket.status = status;
        await ticketRepo.save(ticket);

        return res.send(ticket);
      }
    );
}
