import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { User } from "../../database/entities/user.entity.js";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { auth } from "../../middleware/auth.js";

export async function getProfile(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/profile",
      {
        schema: {
          tags: ["auth"],
          summary: "Get authenticated user profile",
          security: [{ bearerAuth: [] }],
          response: {
            200: z.object({
              user: z.object({
                id: z.uuid(),
                name: z.string(),
                email: z.email(),
                role: z.string(),
              }),
            }),
          },
        },
      },
      async (req, res) => {
        const userId = await req.getCurrentUserId();

        const userRepo = req.server.db.dataSource.getRepository(User);

        const user = await userRepo.findOne({
          where: {
            id: userId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        });

        console.log(user);

        if (!user) {
          throw new BadRequestError("User not found");
        }

        return res.send({ user });
      }
    );
}
