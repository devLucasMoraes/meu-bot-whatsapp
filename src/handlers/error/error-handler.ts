import type { FastifyError, FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { BadRequestError } from "../../errors/bad-request-error.js";
import { UnauthorizedError } from "../../errors/unauthorized-error.js";

type FastifyErrorHandler = FastifyInstance["errorHandler"];

export const errorHandler: FastifyErrorHandler = (error, req, res) => {
  if (error instanceof ZodError) {
    return res.status(400).send({
      statusCode: 400,
      message: "Validation error",
      errors: z.treeifyError(error),
    });
  }

  const fastifyError = error as FastifyError;

  if (fastifyError.validation) {
    const errors: Record<string, string[]> = {};

    for (const validationError of fastifyError.validation) {
      const path = validationError.instancePath.substring(1) || "_error";

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
