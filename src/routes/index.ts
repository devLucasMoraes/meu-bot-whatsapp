import { FastifyInstance } from "fastify";
import authRoutes from "./auth/index.js";

export default async function registerRoutes(app: FastifyInstance) {
  /* Estoque */
  app.register(authRoutes, { prefix: "/api/v1" });
}
