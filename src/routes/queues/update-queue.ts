import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Queue } from "../../database/entities/queue.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { auth } from "../../middleware/auth.js";

export async function updateQueue(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put(
      "/queues/:id",
      {
        schema: {
          tags: ["queues"],
          summary: "Editar fila",
          security: [{ bearerAuth: [] }],
          params: z.object({
            id: z.string().uuid(),
          }),
          body: z.object({
            name: z.string().min(2).optional(),
            color: z
              .string()
              .regex(/^#([0-9A-F]{3}){1,2}$/i)
              .optional(),
            greetingMessage: z.string().optional(),
          }),
          response: {
            200: z.object({
              id: z.string().uuid(),
              message: z.string(),
            }),
          },
        },
      },
      async (req, res) => {
        const { id } = req.params;
        const { name, color, greetingMessage } = req.body;

        const queueRepo = req.server.db.dataSource.getRepository(Queue);
        const queue = await queueRepo.findOneBy({ id });

        if (!queue) {
          throw new BadRequestError("Fila não encontrada.");
        }

        // Valida se o usuário tem acesso ao Tenant desta fila
        await req.validateTenantAccess(queue.tenantId);

        // Atualiza os campos
        queue.name = name ?? queue.name;
        queue.color = color ?? queue.color;
        queue.greetingMessage = greetingMessage ?? queue.greetingMessage;

        await queueRepo.save(queue);

        return res.status(200).send({
          id: queue.id,
          message: "Queue atualizada com sucesso.",
        });
      }
    );
}
