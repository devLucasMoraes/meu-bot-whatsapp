import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

export async function logout(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/sessions/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Logout user and clear refresh token',
        response: {
          204: z.null(),
        },
      },
    },
    async (req, res) => {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      })

      return res.status(204).send()
    },
  )
}
