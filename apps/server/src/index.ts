import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { claudeBin } from './agent/claude-bin.ts'
import { internalRoutes } from './agent/routes.ts'
import { disposeAll } from './agent/runtime.ts'
import { authRoutes } from './auth/routes.ts'
import { AuthService } from './auth/service.ts'
import { config } from './config.ts'
import { runMigrations } from './db/index.ts'
import { fileRoutes } from './files/routes.ts'
import { roomRoutes } from './rooms/routes.ts'
import { RoomService } from './rooms/service.ts'
import { hub } from './ws/hub.ts'
import { wsRoutes } from './ws/routes.ts'

runMigrations()
await RoomService.resetStuckRooms()

AuthService.subscribe((auth) => hub.broadcastAll({ type: 'auth', auth }))

export const app = new Elysia()
	.use(cors({ origin: config.corsOrigin }))
	.onError(({ error, code, set }) => {
		if (code === 'NOT_FOUND') return 'Not Found'
		console.error('[server]', error)
		set.status = 500
		return { error: error instanceof Error ? error.message : 'internal error' }
	})
	.get('/health', () => ({ ok: true }))
	.use(authRoutes)
	.use(roomRoutes)
	.use(fileRoutes)
	.use(internalRoutes)
	.use(wsRoutes)
	.listen(config.port)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		disposeAll()
		process.exit(0)
	})
}

const auth = await AuthService.status()
console.log(`multiclaude → http://localhost:${config.port}`)
console.log(`claude       ${claudeBin}`)
console.log(`auth         ${auth.loggedIn ? `${auth.email} (${auth.plan})` : 'non connecté'}`)

export type App = typeof app
