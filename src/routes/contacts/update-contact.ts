import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Contact } from "../../database/entities/contact.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function updateContact(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put(
      "/contacts/:id",
      {
        schema: {
          tags: ["contacts"],
          summary: "Atualizar contato",
          security: [{ bearerAuth: [] }],
          params: z.object({
            id: z.string().uuid(),
          }),
          body: z.object({
            name: z.string().min(1),
            profilePicUrl: z.string().optional(),
          }),
          response: {
            200: z.object({
              id: z.string().uuid(),
              name: z.string().nullable(),
              number: z.string(),
              profilePicUrl: z.string().nullable(),
              updatedAt: z.date(),
            }),
          },
        },
      },
      async (req, res) => {
        const { id } = req.params;
        const { name, profilePicUrl } = req.body;
        const userId = await req.getCurrentUserId();

        const userRepo = req.server.db.dataSource.getRepository(User);
        const contactRepo = req.server.db.dataSource.getRepository(Contact);

        // Verifica Tenant
        const currentUser = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!currentUser || !currentUser.tenant) {
          throw new UnauthorizedError("Usuário sem Tenant.");
        }

        // Busca o contato pelo ID e TenantId (segurança)
        const contact = await contactRepo.findOne({
          where: {
            id,
            tenantId: currentUser.tenant.id,
          },
        });

        if (!contact) {
          throw new BadRequestError("Contato não encontrado.");
        }

        // Atualiza campos
        contact.name = name;
        if (profilePicUrl !== undefined) {
          contact.profilePicUrl = profilePicUrl;
        }

        await contactRepo.save(contact);

        return res.send(contact);
      }
    );
}
