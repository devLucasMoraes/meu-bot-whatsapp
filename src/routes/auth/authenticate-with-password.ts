import { compare } from "bcryptjs";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";

export async function authWithPassword(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/sessions/password",
    {
      schema: {
        tags: ["auth"],
        summary: "Authenticate user with email and password",
        body: z.object({
          email: z.email(),
          password: z.string().min(6),
        }),
        response: {
          201: z.object({
            accessToken: z.string(),
          }),
        },
      },
    },
    async (req, res) => {
      const { email, password } = req.body;

      const userRepo = req.server.db.dataSource.getRepository(User);

      // Busca o usuário incluindo o Tenant para colocar o ID no token se necessário
      const userFromEmail = await userRepo.findOne({
        where: { email },
        relations: ["tenant"],
      });

      if (!userFromEmail) {
        throw new BadRequestError("E-mail ou senha incorretos.");
      }

      // Verifica se a senha existe (caso tenha login social no futuro)
      if (!userFromEmail.passwordHash) {
        throw new BadRequestError(
          "Usuário não possui senha definida, use login social."
        );
      }

      const isPasswordValid = await compare(
        password,
        userFromEmail.passwordHash
      );

      if (!isPasswordValid) {
        throw new BadRequestError("E-mail ou senha incorretos.");
      }

      // Gera o Token de Acesso (Curta duração)
      const accessToken = await res.jwtSign(
        {
          sub: userFromEmail.id,
          role: userFromEmail.role,
          tenantId: userFromEmail.tenant.id,
          type: "access",
        },
        {
          sign: {
            expiresIn: "15m", // 15 minutos
          },
        }
      );

      // Gera o Refresh Token (Longa duração)
      const refreshToken = await res.jwtSign(
        {
          sub: userFromEmail.id,
          type: "refresh",
        },
        {
          sign: {
            expiresIn: "7d", // 7 dias
          },
        }
      );

      // Define o Cookie HTTP Only
      res.setCookie("refreshToken", refreshToken, {
        path: "/",
        secure: process.env.NODE_ENV === "production", // True em produção (HTTPS)
        httpOnly: true, // Inacessível via JS no frontend
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60, // 7 dias em segundos
      });

      return res.status(201).send({ accessToken });
    }
  );
}
