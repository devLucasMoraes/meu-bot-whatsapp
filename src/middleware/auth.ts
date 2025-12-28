import { FastifyInstance, FastifyRequest } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { AppDataSource } from "../database/data-source.js";
import { Tenant } from "../database/entities/tenant.entity.js";
import { User } from "../database/entities/user.entity.js";
import { ForbiddenError } from "../errors/forbidden-error.js";
import { UnauthorizedError } from "../errors/unauthorized-error.js";

// ------------------------------------------------------------------
// Tipagens e Extensões
// ------------------------------------------------------------------

// Interface para representar o Socket remoto com a propriedade userId
// que injetamos no socket-io-plugin.ts. Isso evita o uso de "any".
interface AuthenticatedRemoteSocket {
  userId?: string;
  id: string;
  join: (room: string) => void;
  rooms: Set<string>;
  data: any;
}

// Extensão do Request do Fastify para incluir nossos helpers de auth
declare module "fastify" {
  interface FastifyRequest {
    getCurrentUserId: () => Promise<string>;
    validateTenantAccess: (tenantId: string) => Promise<{
      user: User;
      tenant: Tenant;
    }>;
  }
}

// ------------------------------------------------------------------
// Funções Auxiliares
// ------------------------------------------------------------------

/**
 * Função responsável por sincronizar os sockets do usuário com a sala do Tenant.
 * Isso garante que, assim que a API REST valida o acesso, o WebSocket
 * também esteja "ouvindo" os eventos daquele Tenant.
 */
async function syncUserSocketsToTenantRoom(
  app: FastifyInstance,
  userId: string,
  tenantId: string
) {
  try {
    // Se o IO não estiver pronto, retornamos para evitar erros
    if (!app.io) return;

    // Busca todos os sockets conectados nesta instância
    const sockets = await app.io.fetchSockets();

    // Filtramos os sockets que pertencem ao usuário atual.
    // Usamos Type Assertion para garantir ao TS que sabemos que o userId existe
    const userSockets = sockets.filter((socket) => {
      const s = socket as unknown as AuthenticatedRemoteSocket;
      return s.userId === userId;
    });

    // Nome da sala conforme padrão definido no socket-io-plugin.ts
    const roomName = `tenant:${tenantId}`;

    // Itera sobre os sockets do usuário e adiciona na sala se ainda não estiver
    for (const socket of userSockets) {
      if (!socket.rooms.has(roomName)) {
        socket.join(roomName);
        app.log.info(
          `[Auth] Socket ${socket.id} sincronizado com a sala: ${roomName}`
        );
      }
    }
  } catch (error) {
    // Logamos o erro mas não travamos a requisição HTTP por causa do Socket
    app.log.error(error, `Erro ao sincronizar sockets para user ${userId}`);
  }
}

// ------------------------------------------------------------------
// Plugin Principal
// ------------------------------------------------------------------

export const auth = fastifyPlugin(async (app: FastifyInstance) => {
  // Decoramos o request inicialmente para garantir que as propriedades existam e tenham um valor inicial
  app.decorateRequest("getCurrentUserId", async () => {
    throw new Error("getCurrentUserId not implemented");
  });
  app.decorateRequest("validateTenantAccess", async () => {
    throw new Error("validateTenantAccess not implemented");
  });

  app.addHook("preHandler", async (req: FastifyRequest) => {
    /**
     * Helper 1: Apenas extrai e valida o ID do usuário do Token JWT.
     * Útil para rotas que não dependem de um Tenant específico (ex: /profile).
     */
    req.getCurrentUserId = async () => {
      try {
        const { sub } = await req.jwtVerify<{ sub: string }>();

        if (!sub) {
          throw new UnauthorizedError("Token inválido: sub não encontrado");
        }

        return sub;
      } catch (err) {
        app.log.error(err, `Erro ao sincronizar sockets para user`);
        throw new UnauthorizedError(
          "Token de autenticação inválido ou expirado"
        );
      }
    };

    /**
     * Helper 2: Valida se o usuário pertence ao Tenant solicitado e retorna os dados completos.
     */
    req.validateTenantAccess = async (tenantId: string) => {
      // 1. Garante que o usuário está autenticado
      const userId = await req.getCurrentUserId();

      // 2. Busca o usuário e seus dados de Tenant no banco
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        relations: ["tenant"], // Carrega a relação com a entidade Tenant
      });

      // 3. Validações de existência
      if (!user) {
        throw new UnauthorizedError("Usuário não encontrado no banco de dados");
      }

      if (!user.tenant) {
        throw new ForbiddenError("Usuário não está vinculado a nenhum Tenant");
      }

      // 4. Validação de Segurança: O usuário pertence ao Tenant solicitado?
      if (user.tenant.id !== tenantId) {
        throw new ForbiddenError(
          "Acesso negado: Você não pertence a esta organização"
        );
      }

      // 5. Sincronia Real-time (Socket.IO)
      // Aproveitamos que já validamos o acesso para conectar o socket do usuário à sala
      await syncUserSocketsToTenantRoom(app, userId, user.tenant.id);

      // 6. Retorno alinhado às entidades do projeto
      return {
        user,
        tenant: user.tenant,
      };
    };
  });
});
