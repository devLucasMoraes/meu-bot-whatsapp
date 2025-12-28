import { FastifyInstance } from "fastify";
import { authWithPassword } from "./authenticate-with-password.js";
import { createAccount } from "./create-account.js";
import { getProfile } from "./get-profile.js";
import { logout } from "./logout.js";
import { refreshToken } from "./refresh-token.js";

export default async function authRoutes(app: FastifyInstance) {
  app.register(createAccount);
  app.register(authWithPassword);
  app.register(getProfile);
  app.register(logout);
  app.register(refreshToken);
}
