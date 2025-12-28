import { FastifyInstance } from "fastify";
import authRoutes from "./auth/index.js";
import instancesRoutes from "./whatsapp-instances/index.js";

export default async function registerRoutes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: "/api/v1" });
  app.register(instancesRoutes, { prefix: "/api/v1" });
}
