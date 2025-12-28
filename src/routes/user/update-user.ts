import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { In } from "typeorm";
import { z } from "zod";
import { Queue } from "../../database/entities/queue.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { auth } from "../../middleware/auth.js";

export async function updateUser(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put(
      "/users/:id",
      {
        schema: {
          tags: ["users"],
          summary: "Atualizar dados/filas do agente",
          security: [{ bearerAuth: [] }],
          params: z.object({
            id: z.string().uuid(),
          }),
          body: z.object({
            name: z.string().min(3).optional(),
            role: z.enum(["admin", "agent"]).optional(),
            queueIds: z.array(z.string().uuid()).optional(),
          }),
          response: {
            200: z.object({
              message: z.string(),
            }),
          },
        },
      },
      async (req, res) => {
        const { id } = req.params;
        const { name, role, queueIds } = req.body;

        const userRepo = req.server.db.dataSource.getRepository(User);
        const queueRepo = req.server.db.dataSource.getRepository(Queue);

        // Busca o usuário alvo
        const userToUpdate = await userRepo.findOne({
          where: { id },
          relations: ["tenant"], // Necessário para validar acesso
        });

        if (!userToUpdate) {
          throw new BadRequestError("Usuário não encontrado.");
        }

        // Valida se o usuário logado tem permissão no Tenant do usuário alvo
        await req.validateTenantAccess(userToUpdate.tenantId);

        // Atualiza campos simples
        if (name) userToUpdate.name = name;
        if (role) userToUpdate.role = role;

        // Atualiza filas se forem passadas
        if (queueIds) {
          const queues = await queueRepo.find({
            where: {
              id: In(queueIds),
              tenantId: userToUpdate.tenantId,
            },
          });

          // Sobrescreve as filas do usuário
          userToUpdate.queues = queues;
        }

        await userRepo.save(userToUpdate);

        return res.status(200).send({ message: "User atualizado." });
      }
    );
}
