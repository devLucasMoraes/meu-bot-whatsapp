import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { fastify, FastifyInstance } from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env } from "../src/env.js";

import { errorHandler } from "./error-handler.js";
import socketIoPlugin from "./lib/socket-io-plugin.js";
import typeormPlugin from "./lib/typeorm-plugin.js";
import whatsappPlugin from "./lib/whatsapp-plugin.js";

export default async function createApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: "info",
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:dd-mm-yyyy HH:MM:ss",
          ignore: "pid,hostname",
          messageFormat: "{msg}",
          singleLine: true,
          customColors: "error:red,warn:yellow,info:blue,debug:white",
        },
      },
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            path: request.routeOptions.url,
            parameters: request.params,
          };
        },
        res(reply) {
          return {
            statusCode: reply.statusCode,
          };
        },
      },
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler(errorHandler);

  app.register(typeormPlugin);

  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "WhatsApp Bot",
        description: "WhatsApp Bot API",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
  });

  app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: "refreshToken",
      signed: false,
    },
  });

  app.register(fastifyCookie, {
    secret: env.COOKIE_SECRET,
    parseOptions: {
      httpOnly: true,
      sameSite: "strict",
    },
  });

  app.register(fastifyCors, {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });

  app.register(socketIoPlugin, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    auth: true,
  });

  app.register(whatsappPlugin);

  return app;
}
