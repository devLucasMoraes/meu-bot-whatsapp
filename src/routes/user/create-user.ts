import { hash } from "bcryptjs";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { In } from "typeorm";
import { z } from "zod";
import { Queue } from "../../database/entities/queue.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";
import { auth } from "../../middleware/auth.js";

export async function createUser(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      "/users",
      {
        schema: {
          tags: ["users"],
          summary: "Convidar/Criar novo agente",
          security: [{ bearerAuth: [] }],
          body: z.object({
            name: z.string().min(3),
            email: z.string().email(),
            password: z.string().min(6),
            role: z.enum(["admin", "agent"]).default("agent"),
            queueIds: z.array(z.string().uuid()).optional(),
          }),
          response: {
            201: z.object({
              id: z.string().uuid(),
              message: z.string(),
            }),
          },
        },
      },
      async (req, res) => {
        const { name, email, password, role, queueIds } = req.body;
        const currentUserId = await req.getCurrentUserId();

        const userRepo = req.server.db.dataSource.getRepository(User);
        const queueRepo = req.server.db.dataSource.getRepository(Queue);

        // Identifica o Tenant do usuário logado
        const currentUser = await userRepo.findOne({
          where: { id: currentUserId },
          relations: ["tenant"],
        });

        if (!currentUser || !currentUser.tenant) {
          throw new UnauthorizedError("Usuário logado sem Tenant.");
        }

        // Valida se o email já existe
        const userExists = await userRepo.findOne({ where: { email } });
        if (userExists) {
          throw new BadRequestError("E-mail já está em uso.");
        }

        // Busca as filas informadas garantindo que pertencem ao mesmo Tenant
        let queues: Queue[] = [];
        if (queueIds && queueIds.length > 0) {
          queues = await queueRepo.find({
            where: {
              id: In(queueIds),
              tenantId: currentUser.tenant.id,
            },
          });

          if (queues.length !== queueIds.length) {
            throw new BadRequestError("Uma ou mais filas são inválidas.");
          }
        }

        const passwordHash = await hash(password, 6);

        const newUser = userRepo.create({
          name,
          email,
          passwordHash,
          role,
          tenant: currentUser.tenant,
          queues: queues,
        });

        await userRepo.save(newUser);

        return res.status(201).send({
          id: newUser.id,
          message: "User criado com sucesso.",
        });
      }
    );
}
