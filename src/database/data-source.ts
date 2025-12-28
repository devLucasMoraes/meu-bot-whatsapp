import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "../config/env.js";
import { AuthSession } from "./entities/auth-session.entity.js";
import { Contact } from "./entities/contact.entity.js";
import { Message } from "./entities/message.entity.js";
import { Queue } from "./entities/queue.entity.js";
import { Tenant } from "./entities/tenant.entity.js";
import { Ticket } from "./entities/ticket.entity.js";
import { User } from "./entities/user.entity.js";
import { WhatsappInstance } from "./entities/whatsappInstance.entity.js";

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
