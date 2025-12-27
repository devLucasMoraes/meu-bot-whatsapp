import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Server, ServerOptions, Socket } from 'socket.io'

export interface FastifySocketIOOptions extends Partial<ServerOptions> {
  preClose?: (done: () => void) => void
  auth?: boolean // Habilita/desabilita autenticação (padrão: true)
}

declare module 'fastify' {
  interface FastifyInstance {
    io: Server
  }
}

declare module 'socket.io' {
  interface Socket {
    userId?: string // Armazena os dados do usuário autenticado
  }
}

const socketIOPlugin: FastifyPluginAsync<FastifySocketIOOptions> = async (
  fastify,
  options,
) => {
  const defaultPreClose = (done: () => void) => {
    fastify.io.local.disconnectSockets(true)
    done()
  }

  const io = new Server(fastify.server, options)

  // Middleware de autenticação
  if (options.auth !== false) {
    io.use(async (socket: Socket, next) => {
      try {
        // 1. Tentar obter token do cabeçalho Authorization
        let token = socket.handshake.headers.authorization?.split(' ')[1]

        // 2. Se não encontrado, tentar obter dos cookies
        if (!token && socket.handshake.headers.cookie) {
          const cookies = fastify.parseCookie(socket.handshake.headers.cookie)
          token = cookies.refreshToken || cookies.accessToken
        }

        if (!token) {
          throw new Error('Token não fornecido')
        }

        // 3. Verificar token e decodificar
        const { sub } = fastify.jwt.verify<{
          sub: string
        }>(token)
        socket.userId = sub
        next()
      } catch (err) {
        fastify.log.error(
          err instanceof Error ? err.message : 'Falha na autenticação',
        )
        next(new Error('Não autorizado'))
      }
    })
  }

  fastify.decorate('io', io)
  fastify.log.info('Socket.IO plugin inicializado')

  fastify.addHook('preClose', (done) => {
    options.preClose ? options.preClose(done) : defaultPreClose(done)
  })

  fastify.addHook('onClose', (_, done) => {
    io.close(() => {
      fastify.log.info('Servidor Socket.IO fechado')
      done()
    })
  })
}

export default fp(socketIOPlugin, {
  name: 'socket-io-plugin',
  fastify: '5.x',
})
