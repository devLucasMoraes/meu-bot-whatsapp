import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { User } from "../../database/entities/user.entity.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function listUsers(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/users",
      {
        schema: {
          tags: ["users"],
          summary: "Listar usuários do time",
          security: [{ bearerAuth: [] }],
          response: {
            200: z.array(
              z.object({
                id: z.string().uuid(),
                name: z.string(),
                email: z.string().email(),
                role: z.string(),
                createdAt: z.date(),
                queues: z.array(
                  z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    color: z.string(),
                  })
                ),
              })
            ),
          },
        },
      },
      async (req, res) => {
        const userId = await req.getCurrentUserId();
        const userRepo = req.server.db.dataSource.getRepository(User);

        // Busca o usuário atual para descobrir o Tenant
        const currentUser = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!currentUser || !currentUser.tenant) {
          throw new UnauthorizedError("Usuário ou Tenant não encontrado.");
        }

        // Busca todos os usuários do mesmo Tenant
        const users = await userRepo.find({
          where: { tenantId: currentUser.tenant.id },
          relations: ["queues"], // Inclui as filas na resposta
          select: {
            // Seleciona campos específicos para não expor passwordHash
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            queues: {
              id: true,
              name: true,
              color: true,
            },
          },
          order: { name: "ASC" },
        });

        return res.send(users);
      }
    );
}
