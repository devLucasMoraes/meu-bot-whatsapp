import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { BadRequestError } from "./_errors/bad-request-error.js";
import { UnauthorizedError } from "./_errors/unauthorized-error.js";

type FastifyErrorHandler = FastifyInstance["errorHandler"];
export const errorHandler: FastifyErrorHandler = (error, req, res) => {
  if (error instanceof ZodError) {
    return res.status(400).send({
      statusCode: 400,
      message: "Validation error",
      errors: error.flatten().fieldErrors,
    });
  }

  if (error.validation) {
    const errors: Record<string, string[]> = {};

    for (const validationError of error.validation) {
      // Remove a barra inicial do caminho, se houver
      const path = validationError.instancePath.substring(1) || "_error";

      // Adiciona a mensagem de erro ao caminho correspondente
      if (!errors[path]) {
        errors[path] = [];
      }

      if (validationError.message) {
        errors[path].push(validationError.message);
      }
    }

    return res.status(400).send({
      statusCode: 400,
      message: "Validation error",
      errors,
    });
  }

  if (error instanceof BadRequestError) {
    return res.status(400).send({
      statusCode: 400,
      message: error.message,
    });
  }

  if (error instanceof UnauthorizedError) {
    return res.status(401).send({
      statusCode: 401,
      message: error.message,
    });
  }

  console.log("Tipo do erro:", typeof error);
  console.error(error);

  return res.status(500).send({
    statusCode: 500,
    message: "Internal server error",
  });
};
