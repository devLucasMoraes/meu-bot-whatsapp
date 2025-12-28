import { FastifyInstance } from "fastify";
import authRoutes from "./auth/index.js";
import contactsRoutes from "./contacts/index.js";
import queuesRoutes from "./queues/index.js";
import usersRoutes from "./user/index.js";
import instancesRoutes from "./whatsapp-instances/index.js";

export default async function registerRoutes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: "/api/v1" });
  app.register(instancesRoutes, { prefix: "/api/v1" });
  app.register(queuesRoutes, { prefix: "/api/v1" });
  app.register(usersRoutes, { prefix: "/api/v1" });
  app.register(contactsRoutes, { prefix: "/api/v1" });
}
