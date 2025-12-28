import { FastifyInstance } from "fastify";
import { getContact } from "./get-contact.js";
import { listContacts } from "./list-contacts.js";
import { updateContact } from "./update-contact.js";

export default async function contactsRoutes(app: FastifyInstance) {
  app.register(listContacts);
  app.register(getContact);
  app.register(updateContact);
}
