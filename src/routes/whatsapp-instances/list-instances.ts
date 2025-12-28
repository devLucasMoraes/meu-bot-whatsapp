import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { User } from "../../database/entities/user.entity.js";
import { WhatsappInstance } from "../../database/entities/whatsappInstance.entity.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function listInstances(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/instances",
      {
        schema: {
          tags: ["instances"],
          summary: "Listar instâncias do Tenant",
          security: [{ bearerAuth: [] }],
          response: {
            200: z.array(
              z.object({
                id: z.string().uuid(),
                name: z.string(),
                status: z.string(),
                isDefault: z.boolean(),
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

        const instanceRepo =
          req.server.db.dataSource.getRepository(WhatsappInstance);

        const instances = await instanceRepo.find({
          where: { tenantId: user.tenant.id },
          order: { createdAt: "DESC" },
        });

        return res.send(instances);
      }
    );
}
