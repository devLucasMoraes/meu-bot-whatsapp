import "reflect-metadata";
import { DataSource } from "typeorm";
import { AuthSession } from "./entities/AuthSession.entity.js";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "docker",
  password: "docker",
  database: "whatsapp_bot",
  synchronize: true,
  logging: false,
  entities: [AuthSession],
});
