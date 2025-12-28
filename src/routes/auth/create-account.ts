import { hash } from "bcryptjs";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Tenant } from "../../database/entities/tenant.entity.js";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";

export async function createAccount(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/create-account",
    {
      schema: {
        tags: ["auth"],
        summary: "Create a new account (Tenant + User)",
        body: z.object({
          name: z.string().min(3),
          email: z.email(),
          password: z.string().min(6),
          companyName: z.string().min(3),
          documentNumber: z.string().min(11),
        }),
        response: {
          201: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (req, res) => {
      const { name, email, password, companyName, documentNumber } = req.body;

      const userRepo = req.server.db.dataSource.getRepository(User);
      const tenantRepo = req.server.db.dataSource.getRepository(Tenant);

      const userFromEmail = await userRepo.findOne({ where: { email } });

      if (userFromEmail) {
        throw new BadRequestError("Este e-mail já está em uso.");
      }

      const tenantFromDoc = await tenantRepo.findOne({
        where: { documentNumber },
      });

      if (tenantFromDoc) {
        throw new BadRequestError("Este documento já está cadastrado.");
      }

      const passwordHash = await hash(password, 6);

      await req.server.db.dataSource.transaction(async (manager) => {
        const tenant = manager.create(Tenant, {
          name: companyName,
          documentNumber,
          status: "active",
        });
        await manager.save(tenant);

        const user = manager.create(User, {
          name,
          email,
          passwordHash,
          role: "admin",
          tenant,
        });
        await manager.save(user);
      });

      return res.status(201).send({ message: "Conta criada com sucesso!" });
    }
  );
}
