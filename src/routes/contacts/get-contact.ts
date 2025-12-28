import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Contact } from "../../database/entities/contact.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function getContact(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/contacts/:id",
      {
        schema: {
          tags: ["contacts"],
          summary: "Detalhes do contato",
          security: [{ bearerAuth: [] }],
          params: z.object({
            id: z.string().uuid(),
          }),
          response: {
            200: z.object({
              id: z.string().uuid(),
              name: z.string().nullable(),
              number: z.string(),
              profilePicUrl: z.string().nullable(),
              createdAt: z.date(),
              updatedAt: z.date(),
              tickets: z
                .array(
                  z.object({
                    id: z.string().uuid(),
                    status: z.string(), // Assumindo campo status no Ticket
                    createdAt: z.date(),
                    // Adicione outros campos de Ticket conforme necessário
                  })
                )
                .optional(),
            }),
          },
        },
      },
      async (req, res) => {
        const { id } = req.params;
        const userId = await req.getCurrentUserId();

        const userRepo = req.server.db.dataSource.getRepository(User);
        const contactRepo = req.server.db.dataSource.getRepository(Contact);

        // Verifica Tenant do utilizador
        const currentUser = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!currentUser || !currentUser.tenant) {
          throw new UnauthorizedError("Usuário sem Tenant.");
        }

        // Busca contacto garantindo tenantId e trazendo Tickets
        const contact = await contactRepo.findOne({
          where: {
            id,
            tenantId: currentUser.tenant.id,
          },
          relations: ["tickets"],
          order: {
            tickets: {
              createdAt: "DESC", // Tickets mais recentes primeiro
            },
          },
        });

        if (!contact) {
          throw new BadRequestError("Contato não encontrado.");
        }

        return res.send(contact);
      }
    );
}
