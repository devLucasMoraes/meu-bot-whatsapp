import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { User } from "../../database/entities/user.entity.js";
import { WhatsappInstance } from "../../database/entities/whatsappInstance.entity.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function createInstance(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      "/instances",
      {
        schema: {
          tags: ["instances"],
          summary: "Criar nova instância (sessão)",
          security: [{ bearerAuth: [] }],
          body: z.object({
            name: z.string().min(3),
            isDefault: z.boolean().default(false),
          }),
          response: {
            201: z.object({
              id: z.string().uuid(),
              name: z.string(),
              status: z.string(),
              qrcode: z.string().nullable().optional(),
            }),
          },
        },
      },
      async (req, res) => {
        const { name, isDefault } = req.body;
        const userId = await req.getCurrentUserId();

        const userRepo = req.server.db.dataSource.getRepository(User);
        const user = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!user || !user.tenant) {
          throw new UnauthorizedError("Usuário ou Tenant não encontrado.");
        }

        const instanceRepo =
          req.server.db.dataSource.getRepository(WhatsappInstance);

        // Se for marcar como default, remove o default das outras
        if (isDefault) {
          await instanceRepo.update(
            { tenantId: user.tenant.id },
            { isDefault: false }
          );
        }

        const instance = instanceRepo.create({
          name,
          isDefault,
          status: "DISCONNECTED",
          tenant: user.tenant,
          qrcode: "",
        });

        await instanceRepo.save(instance);

        // Inicia a instância (Isso vai gerar o QR Code via Socket depois)
        await req.server.whatsapp.start(instance);

        return res.status(201).send({
          id: instance.id,
          name: instance.name,
          status: instance.status,
          qrcode: instance.qrcode,
        });
      }
    );
}
