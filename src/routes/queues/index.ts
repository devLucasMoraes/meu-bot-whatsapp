import { FastifyInstance } from "fastify";
import { createQueue } from "./create-queue.js";
import { deleteQueue } from "./delete-queue.js";
import { listQueues } from "./list-queues.js";
import { updateQueue } from "./update-queue.js";

export default async function queuesRoutes(app: FastifyInstance) {
  app.register(listQueues);
  app.register(createQueue);
  app.register(updateQueue);
  app.register(deleteQueue);
}
