import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Ticket, TicketStatus } from "../../database/entities/ticket.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function listTickets(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/tickets",
      {
        schema: {
          tags: ["tickets"],
          summary: "Listar tickets",
          security: [{ bearerAuth: [] }],
          querystring: z.object({
            status: z.nativeEnum(TicketStatus).optional(),
            queueId: z.string().uuid().optional(),
            userId: z.string().uuid().optional(),
            search: z.string().optional(),
          }),
          response: {
            200: z.array(z.any()), // Retorna a entidade Ticket completa com relações
          },
        },
      },
      async (req, res) => {
        const userId = await req.getCurrentUserId();
        const { status, queueId, userId: filterUserId, search } = req.query;

        const userRepo = req.server.db.dataSource.getRepository(User);
        const ticketRepo = req.server.db.dataSource.getRepository(Ticket);

        const currentUser = await userRepo.findOne({
          where: { id: userId },
          relations: ["tenant"],
        });

        if (!currentUser || !currentUser.tenant) {
          throw new UnauthorizedError("Usuário ou Tenant não encontrado.");
        }

        const query = ticketRepo
          .createQueryBuilder("ticket")
          .leftJoinAndSelect("ticket.contact", "contact")
          .leftJoinAndSelect("ticket.queue", "queue")
          .leftJoinAndSelect("ticket.user", "user")
          .leftJoinAndSelect("ticket.whatsapp", "whatsapp")
          .where("ticket.tenantId = :tenantId", {
            tenantId: currentUser.tenant.id,
          });

        if (status) {
          query.andWhere("ticket.status = :status", { status });
        }

        if (queueId) {
          // No QueryBuilder referenciamos a coluna FK da tabela (que é queueId),
          // ou usamos o join: 'queue.id = :queueId'
          query.andWhere("ticket.queueId = :queueId", { queueId });
        }

        if (filterUserId) {
          query.andWhere("ticket.userId = :filterUserId", { filterUserId });
        }

        if (search) {
          query.andWhere(
            "(contact.name ILIKE :search OR contact.number ILIKE :search)",
            { search: `%${search}%` }
          );
        }

        query.orderBy("ticket.updatedAt", "DESC");

        const tickets = await query.getMany();

        return res.send(tickets);
      }
    );
}
