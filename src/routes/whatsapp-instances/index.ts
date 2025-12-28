import { FastifyInstance } from "fastify";
import { createInstance } from "./create-instance.js";
import { deleteInstance } from "./delete-instance.js";
import { getInstance } from "./get-instance.js";
import { listInstances } from "./list-instances.js";
import { logoutInstance } from "./logout-instance.js";

export default async function instancesRoutes(app: FastifyInstance) {
  app.register(listInstances);
  app.register(createInstance);
  app.register(getInstance);
  app.register(logoutInstance);
  app.register(deleteInstance);
}
