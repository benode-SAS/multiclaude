import { Elysia, t } from 'elysia'
import { AuthService } from './service.ts'

export const authRoutes = new Elysia({ prefix: '/auth' })
	.get('/', () => AuthService.status())
	.post('/login', () => AuthService.startLogin())
	.post('/code', ({ body }) => AuthService.submitCode(body.code), {
		body: t.Object({ code: t.String({ minLength: 1 }) }),
	})
	.post('/cancel', () => AuthService.cancelLogin())
	.post('/logout', () => AuthService.logout())
