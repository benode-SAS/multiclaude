import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { claudeBin, claudeBinResolved } from './agent/claude-bin.ts'
import { internalRoutes } from './agent/routes.ts'
import { disposeAll } from './agent/runtime.ts'
import { authRoutes } from './auth/routes.ts'
import { AuthService } from './auth/service.ts'
import { config } from './config.ts'
import { runMigrations } from './db/index.ts'
import { fileRoutes } from './files/routes.ts'
import { roomRoutes } from './rooms/routes.ts'
import { RoomService } from './rooms/service.ts'
import { webRoutes } from './web.ts'
import { hub } from './ws/hub.ts'
import { wsRoutes } from './ws/routes.ts'

runMigrations()
await RoomService.resetStuckRooms()

const serveWeb = config.serveWeb && config.webDistExists
if (config.serveWeb && !serveWeb) {
	console.warn(`[web] SERVE_WEB actif mais ${config.webDist} est absent — lance "bun run build"`)
}

AuthService.subscribe((auth) => hub.broadcastAll({ type: 'auth', auth }))

/** Everything REST lives under /api so the front uses one path in dev and prod. */
const api = new Elysia({ prefix: '/api' })
	.get('/health', () => ({ ok: true }))
	.use(authRoutes)
	.use(roomRoutes)
	.use(fileRoutes)
	.use(internalRoutes)

export const app = new Elysia()
	.use(cors({ origin: config.corsOrigin }))
	.onError(({ error, code, set }) => {
		if (code === 'NOT_FOUND') return 'Not Found'
		console.error('[server]', error)
		set.status = 500
		return { error: error instanceof Error ? error.message : 'internal error' }
	})
	.use(api)
	.use(wsRoutes)
	.use(serveWeb ? webRoutes : new Elysia())
	.listen(config.port)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		disposeAll()
		process.exit(0)
	})
}

const auth = await AuthService.status()
console.log(`multiclaude → http://localhost:${config.port}`)
console.log(
	`claude       ${claudeBin}${claudeBinResolved ? '' : ' (INTROUVABLE — définis CLAUDE_BIN)'}`,
)
console.log(`data         ${config.dataDir}`)
console.log(`front        ${serveWeb ? config.webDist : 'servi par vite (bun run dev)'}`)
console.log(`auth         ${auth.loggedIn ? `${auth.email} (${auth.plan})` : 'non connecté'}`)

export type App = typeof app
