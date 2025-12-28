import { FastifyInstance } from "fastify";
import { createUser } from "./create-user.js";
import { deleteUser } from "./delete-user.js";
import { listUsers } from "./list-users.js";
import { updateUser } from "./update-user.js";

export default async function usersRoutes(app: FastifyInstance) {
  app.register(listUsers);
  app.register(createUser);
  app.register(updateUser);
  app.register(deleteUser);
}
