import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Queue } from "../../database/entities/queue.entity.js";
import { Ticket } from "../../database/entities/ticket.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { auth } from "../../middleware/auth.js";

export async function deleteQueue(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete(
      "/queues/:id",
      {
        schema: {
          tags: ["queues"],
          summary: "Remover fila",
          security: [{ bearerAuth: [] }],
          params: z.object({
            id: z.string().uuid(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (req, res) => {
        const { id } = req.params;
        const dataSource = req.server.db.dataSource;
        const queueRepo = dataSource.getRepository(Queue);
        const ticketRepo = dataSource.getRepository(Ticket);

        const queue = await queueRepo.findOneBy({ id });

        if (!queue) {
          throw new BadRequestError("Fila não encontrada.");
        }

        // Valida acesso
        await req.validateTenantAccess(queue.tenantId);

        // Regra de Negócio: Verificar tickets vinculados
        const ticketsCount = await ticketRepo.count({
          where: { queue: { id: queue.id } },
        });

        if (ticketsCount > 0) {
          throw new BadRequestError(
            `Não é possível excluir esta fila pois existem ${ticketsCount} tickets vinculados a ela.`
          );
        }

        await queueRepo.delete(queue.id);

        return res.status(204).send();
      }
    );
}
