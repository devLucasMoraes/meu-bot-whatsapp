import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().default("dev-secret"),
  COOKIE_SECRET: z.string().default("dev-cookie-secret"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),

  // Banco de Dados
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default("docker"),
  DB_PASS: z.string().default("docker"),
  DB_NAME: z.string().default("whatsapp_bot"),
});

export const env = envSchema.parse(process.env);
