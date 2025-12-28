import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Queue } from "../../database/entities/queue.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function createQueue(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      "/queues",
      {
        schema: {
          tags: ["queues"],
          summary: "Criar nova fila",
          security: [{ bearerAuth: [] }],
          body: z.object({
            name: z.string().min(2),
            color: z
              .string()
              .regex(/^#([0-9A-F]{3}){1,2}$/i, "Cor inválida (Hex)"),
            greetingMessage: z.string().optional(),
          }),
          response: {
            201: z.object({
              id: z.string().uuid(),
              name: z.string(),
              color: z.string(),
            }),
          },
        },
      },
      async (req, res) => {
        const { name, color, greetingMessage } = req.body;
        const userId = await req.getCurrentUserId();

        const userRepo = req.server.db.dataSource.getRepository(User);
        const user = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!user || !user.tenant) {
          throw new UnauthorizedError("Usuário ou Tenant não encontrado.");
        }

        const queueRepo = req.server.db.dataSource.getRepository(Queue);

        const queue = queueRepo.create({
          name,
          color,
          greetingMessage,
          tenant: user.tenant,
        });

        await queueRepo.save(queue);

        return res.status(201).send({
          id: queue.id,
          name: queue.name,
          color: queue.color,
        });
      }
    );
}
