import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { bootstrapAdmin } from './accounts/bootstrap.ts'
import { accountRoutes } from './accounts/routes.ts'
import { AccountService } from './accounts/service.ts'
import { SettingsService } from './accounts/settings.ts'
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
import { VERSION, versionInfo } from './updates.ts'
import { webRoutes } from './web.ts'
import { hub } from './ws/hub.ts'
import { wsRoutes } from './ws/routes.ts'

runMigrations()

const serveWeb = config.serveWeb && config.webDistExists

AuthService.subscribe((auth) => hub.broadcastAll({ type: 'auth', auth }))

/** Everything REST lives under /api so the front uses one path in dev and prod. */
const api = new Elysia({ prefix: '/api' })
	.get('/health', () => ({ ok: true }))
	.get('/version', () => versionInfo())
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
	.use(accountRoutes)
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

/** Says exactly why the front is or is not being served — the usual head-scratcher. */
function describeFront() {
	if (serveWeb) return config.webDist
	if (!config.serveWeb) return 'disabled (SERVE_WEB=false) — serve it with vite or another host'
	return `NONE: ${config.webDist} is missing, run "bun run build"`
}

/**
 * Kept out of the module top level: a top-level `await` makes this an async
 * module, which supervisors that `require()` the entry point (PM2's bun
 * container among them) cannot load.
 */
async function bootstrap() {
	await RoomService.resetStuckRooms()
	await bootstrapAdmin()
	const accounts = await AccountService.count()
	const auth = await AuthService.status()

	console.log(`multiclaude ${VERSION} → http://localhost:${config.port}`)
	console.log(
		`claude       ${claudeBin}${claudeBinResolved ? '' : ' (NOT FOUND — set CLAUDE_BIN)'}`,
	)
	console.log(`data         ${config.dataDir}`)
	console.log(`front        ${describeFront()}`)
	console.log(`claude auth  ${auth.loggedIn ? `${auth.email} (${auth.plan})` : 'not connected'}`)
	console.log(
		`accounts     ${accounts === 0 ? 'none — the first one created will be an admin' : `${accounts}`}` +
			`${SettingsService.signupEnabled() ? '' : ' · signups closed'}`,
	)
}

void bootstrap()

export type App = typeof app
