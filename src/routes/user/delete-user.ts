import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { auth } from "../../middleware/auth.js";

export async function deleteUser(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete(
      "/users/:id",
      {
        schema: {
          tags: ["users"],
          summary: "Remover acesso do usuário",
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
        const currentUserId = await req.getCurrentUserId();

        if (id === currentUserId) {
          throw new BadRequestError("Você não pode remover a si mesmo.");
        }

        const userRepo = req.server.db.dataSource.getRepository(User);

        const user = await userRepo.findOne({
          where: { id },
          relations: ["tenant"],
        });

        if (!user) {
          throw new BadRequestError("Usuário não encontrado.");
        }

        // Garante segurança entre Tenants
        await req.validateTenantAccess(user.tenantId);

        // Opcional: Derrubar sessões ativas desse usuário (RefreshToken)
        // Como o token JWT não tem revogação imediata sem blacklist,
        // apenas remover do banco e mudar senha/deletar impede novos logins.

        // Remove o usuário
        await userRepo.remove(user);

        return res.status(204).send();
      }
    );
}
