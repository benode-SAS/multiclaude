import { mkdirSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '../../..')
const posix = (p: string) => p.split(path.sep).join('/')

export const config = {
	port: Number(process.env.PORT ?? 3001),
	dataDir: process.env.DATA_DIR ?? path.join(root, 'data'),
	get roomsDir() {
		return path.join(config.dataDir, 'rooms')
	},
	get dbPath() {
		return path.join(config.dataDir, 'app.db')
	},
	get serverUrl() {
		return process.env.SERVER_URL ?? `http://localhost:${config.port}`
	},
	migrationsDir: path.join(import.meta.dir, '../drizzle'),
	corsOrigin: process.env.CORS_ORIGIN ?? true,

	/** Tools requiring a human click before they run. Everything else is auto-allowed. */
	confirmTools: new Set((process.env.CONFIRM_TOOLS ?? 'Bash,KillShell,WebFetch').split(',')),
	permissionHookPath: posix(path.join(import.meta.dir, 'agent/permission-hook.ts')),
	permissionTimeoutSec: Number(process.env.PERMISSION_TIMEOUT ?? 900),

	/** Empty keeps the agent out of the host's user/project Claude settings. */
	settingSources: process.env.SETTING_SOURCES ?? '',
	claudeEnv: {
		MC_SERVER: process.env.SERVER_URL ?? `http://localhost:${process.env.PORT ?? 3001}`,
		...(process.env.CLAUDE_CONFIG_DIR ? { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR } : {}),
	} as Record<string, string>,

	maxUploadBytes: 50 * 1024 * 1024,
}

mkdirSync(config.dataDir, { recursive: true })
mkdirSync(config.roomsDir, { recursive: true })
