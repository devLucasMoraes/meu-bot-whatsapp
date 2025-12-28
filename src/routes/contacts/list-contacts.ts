import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { Brackets } from "typeorm";
import { z } from "zod";
import { Contact } from "../../database/entities/contact.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function listContacts(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/contacts",
      {
        schema: {
          tags: ["contacts"],
          summary: "Listar contatos",
          security: [{ bearerAuth: [] }],
          querystring: z.object({
            search: z.string().optional(),
          }),
          response: {
            200: z.array(
              z.object({
                id: z.string().uuid(),
                name: z.string().nullable(),
                number: z.string(),
                profilePicUrl: z.string().nullable(),
                email: z.string().email().optional().nullable(), // Caso adicione email no futuro
                createdAt: z.date(),
                updatedAt: z.date(),
              })
            ),
          },
        },
      },
      async (req, res) => {
        const userId = await req.getCurrentUserId();
        const { search } = req.query;

        const userRepo = req.server.db.dataSource.getRepository(User);
        const contactRepo = req.server.db.dataSource.getRepository(Contact);

        // 1. Obter o Tenant do utilizador atual
        const currentUser = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!currentUser || !currentUser.tenant) {
          throw new UnauthorizedError("Usuário ou Tenant não encontrado.");
        }

        // 2. Criar QueryBuilder para filtrar por Tenant e Busca Opcional
        const query = contactRepo.createQueryBuilder("contact");

        query.where("contact.tenantId = :tenantId", {
          tenantId: currentUser.tenant.id,
        });

        if (search) {
          query.andWhere(
            new Brackets((qb) => {
              qb.where("contact.name ILIKE :search", {
                search: `%${search}%`,
              }).orWhere("contact.number ILIKE :search", {
                search: `%${search}%`,
              });
            })
          );
        }

        query.orderBy("contact.name", "ASC");

        const contacts = await query.getMany();

        return res.send(contacts);
      }
    );
}
