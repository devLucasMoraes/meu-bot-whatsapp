import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthSession } from "../../database/entities/auth-session.entity.js";
import { WhatsappInstance } from "../../database/entities/whatsappInstance.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { auth } from "../../middleware/auth.js";

export async function logoutInstance(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      "/instances/:id/logout",
      {
        schema: {
          tags: ["instances"],
          summary: "Desconectar a sessão",
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

        // 1. Para o processo no Baileys
        await req.server.whatsapp.stop(instance.id);

        // 2. Limpa a sessão no banco
        await authRepo.delete({ sessionId: instance.id });

        // 3. Atualiza status no banco
        await instanceRepo.update(instance.id, {
          status: "DISCONNECTED",
          qrcode: "",
        });

        return res.status(204).send();
      }
    );
}
