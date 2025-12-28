import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthSession } from "../../database/entities/auth-session.entity.js";
import { WhatsappInstance } from "../../database/entities/whatsappInstance.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { auth } from "../../middleware/auth.js";

export async function deleteInstance(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete(
      "/instances/:id",
      {
        schema: {
          tags: ["instances"],
          summary: "Remover a instância do banco",
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
        const instanceRepo =
          req.server.db.dataSource.getRepository(WhatsappInstance);
        const authRepo = req.server.db.dataSource.getRepository(AuthSession);

        const instance = await instanceRepo.findOneBy({ id });

        if (!instance) {
          throw new BadRequestError("Instância não encontrada.");
        }

        // Valida acesso
        await req.validateTenantAccess(instance.tenantId);

        // 1. Desconecta se estiver rodando
        await req.server.whatsapp.stop(instance.id);

        // 2. Remove sessões
        await authRepo.delete({ sessionId: instance.id });

        // 3. Remove registro do banco
        await instanceRepo.delete(instance.id);

        return res.status(204).send();
      }
    );
}
