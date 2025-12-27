import "reflect-metadata";
import { DataSource } from "typeorm";
import { AuthSession } from "./entities/AuthSession.entity.js";
import { Contact } from "./entities/Contact.entity.js";
import { Message } from "./entities/Message.entity.js";
import { Queue } from "./entities/Queue.entity.js";
import { Tenant } from "./entities/Tenant.entity.js";
import { Ticket } from "./entities/Ticket.entity.js";
import { User } from "./entities/User.entity.js";
import { WhatsappInstance } from "./entities/WhatsappInstance.entity.js";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "docker",
  password: "docker",
  database: "whatsapp_bot",
  synchronize: true,
  logging: false,
  entities: [
    AuthSession,
    Tenant,
    User,
    WhatsappInstance,
    Queue,
    Contact,
    Ticket,
    Message,
  ],
});
