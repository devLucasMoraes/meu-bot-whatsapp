import { FastifyInstance } from "fastify";
import { assignTicketUser } from "./assign-ticket-user.js";
import { createTicket } from "./create-ticket.js";
import { getTicket } from "./get-ticket.js";
import { listTicketMessages } from "./list-ticket-messages.js";
import { listTickets } from "./list-tickets.js";
import { sendTicketMessage } from "./send-ticket-message.js";
import { transferTicketQueue } from "./transfer-ticket-queue.js";
import { updateTicketStatus } from "./update-ticket-status.js";

export default async function ticketsRoutes(app: FastifyInstance) {
  // Rotas CRUD Principal
  app.register(listTickets);
  app.register(getTicket);
  app.register(createTicket);

  // Rotas de Modificação (PATCH)
  app.register(updateTicketStatus);
  app.register(transferTicketQueue);
  app.register(assignTicketUser);

  // Rotas de Mensagens
  app.register(listTicketMessages);
  app.register(sendTicketMessage);
}
