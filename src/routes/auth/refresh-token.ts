import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { User } from "../../database/entities/user.entity.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";

export async function refreshToken(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/sessions/refresh", // Alterei para PATCH /token/refresh, mas pode ser POST /sessions/refresh se preferir
    {
      schema: {
        tags: ["auth"],
        summary: "Refresh access token using http-only cookie",
        response: {
          200: z.object({
            accessToken: z.string(),
          }),
        },
      },
    },
    async (req, res) => {
      // 1. Validar se o cookie existe
      const { refreshToken } = req.cookies;

      if (!refreshToken) {
        throw new UnauthorizedError("Refresh token não encontrado.");
      }

      try {
        // 2. Verificar a assinatura e validade do Token existente no cookie
        const { sub, type } = app.jwt.verify<{ sub: string; type: string }>(
          refreshToken
        );

        if (type !== "refresh") {
          throw new UnauthorizedError("Tipo de token inválido.");
        }

        // 3. Buscar o usuário no banco (TypeORM)
        // Importante trazer o tenant, pois o Access Token precisa do tenantId
        const userRepo = req.server.db.dataSource.getRepository(User);
        const user = await userRepo.findOne({
          where: { id: sub },
          relations: ["tenant"],
        });

        if (!user) {
          throw new UnauthorizedError("Usuário não encontrado.");
        }

        // 4. Gerar um NOVO Access Token
        const newAccessToken = await res.jwtSign(
          {
            sub: user.id,
            name: user.name,
            role: user.role,
            tenantId: user.tenant.id,
            type: "access",
          },
          {
            sign: {
              expiresIn: "15m",
            },
          }
        );

        // 5. Gerar um NOVO Refresh Token (Rotação de token)
        const newRefreshToken = await res.jwtSign(
          {
            sub: user.id,
            type: "refresh",
          },
          {
            sign: {
              expiresIn: "7d",
            },
          }
        );

        // 6. Atualizar o Cookie com o novo Refresh Token
        res.setCookie("refreshToken", newRefreshToken, {
          path: "/",
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60, // 7 dias
        });

        return res.status(200).send({ accessToken: newAccessToken });
      } catch (error) {
        // Se o token for inválido, expirado ou manipulado
        req.log.error(error);
        throw new UnauthorizedError("Refresh token inválido ou expirado.");
      }
    }
  );
}
