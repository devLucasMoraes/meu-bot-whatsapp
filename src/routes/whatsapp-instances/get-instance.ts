import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { WhatsappInstance } from "../../database/entities/whatsappInstance.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { auth } from "../../middleware/auth.js";

export async function getInstance(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/instances/:id",
      {
        schema: {
          tags: ["instances"],
          summary: "Obter status/QR Code atual",
          security: [{ bearerAuth: [] }],
          params: z.object({
            id: z.string().uuid(),
          }),
          response: {
            200: z.object({
              status: z.string(),
              qrcode: z.string().nullable().optional(),
            }),
          },
        },
      },
      async (req, res) => {
        const { id } = req.params;
        const instanceRepo =
          req.server.db.dataSource.getRepository(WhatsappInstance);

        const instance = await instanceRepo.findOneBy({ id });

        if (!instance) {
          throw new BadRequestError("Instância não encontrada.");
        }

        // Valida se o usuário tem acesso ao Tenant desta instância
        await req.validateTenantAccess(instance.tenantId);

        return res.send({
          status: instance.status,
          qrcode: instance.qrcode,
        });
      }
    );
}
