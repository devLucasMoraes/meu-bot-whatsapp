import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "../env.js";
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
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  synchronize: env.NODE_ENV === "development",
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
