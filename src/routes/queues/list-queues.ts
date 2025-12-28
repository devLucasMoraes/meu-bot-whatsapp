import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Queue } from "../../database/entities/queue.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function listQueues(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/queues",
      {
        schema: {
          tags: ["queues"],
          summary: "Listar filas do Tenant",
          security: [{ bearerAuth: [] }],
          response: {
            200: z.array(
              z.object({
                id: z.string().uuid(),
                name: z.string(),
                color: z.string(),
                greetingMessage: z.string().nullable(),
                createdAt: z.date(),
              })
            ),
          },
        },
      },
      async (req, res) => {
        const userId = await req.getCurrentUserId();
        const userRepo = req.server.db.dataSource.getRepository(User);

        // Busca usuário para identificar o Tenant
        const user = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!user || !user.tenant) {
          throw new UnauthorizedError("Usuário ou Tenant não encontrado.");
        }

        const queueRepo = req.server.db.dataSource.getRepository(Queue);

        const queues = await queueRepo.find({
          where: { tenantId: user.tenant.id },
          order: { createdAt: "ASC" },
        });

        return res.send(queues);
      }
    );
}
