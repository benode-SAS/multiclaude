import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '../../..')
const posix = (p: string) => p.split(path.sep).join('/')
const bool = (value: string | undefined, fallback = false) =>
	value === undefined ? fallback : /^(1|true|yes|on)$/i.test(value)

const port = Number(process.env.PORT ?? 8000)
const dataDir = path.resolve(root, process.env.DATA_DIR ?? 'data')
const webDist = path.resolve(root, process.env.WEB_DIST ?? 'apps/web/dist')

export const config = {
	port,
	dataDir,
	roomsDir: path.join(dataDir, 'rooms'),
	dbPath: path.join(dataDir, 'app.db'),
	migrationsDir: path.join(import.meta.dir, '../drizzle'),

	/** Loopback address the permission hook calls back on — never the public URL. */
	internalUrl: `http://127.0.0.1:${port}`,
	corsOrigin: process.env.CORS_ORIGIN ?? true,

	/** Serve the built front from this server so everything lives on one port. */
	serveWeb: bool(process.env.SERVE_WEB, false),
	webDist,
	get webDistExists() {
		return existsSync(path.join(webDist, 'index.html'))
	},

	/**
	 * Tools that always ask, whatever the command policy says. Empty by default:
	 * see agent/policy.ts, which decides per command instead of per tool.
	 */
	alwaysAskTools: new Set(
		(process.env.ALWAYS_ASK_TOOLS ?? '')
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean),
	),
	/** Extra regexes forcing a confirmation, e.g. `ASK_PATTERNS=deploy\.sh,prod`. */
	askPatterns: (process.env.ASK_PATTERNS ?? '')
		.split(',')
		.map((p) => p.trim())
		.filter(Boolean)
		.flatMap((p) => {
			try {
				return [new RegExp(p, 'i')]
			} catch {
				console.warn(`[config] ASK_PATTERNS: motif invalide ignoré (${p})`)
				return []
			}
		}),
	permissionHookPath: posix(path.join(import.meta.dir, 'agent/permission-hook.ts')),
	permissionTimeoutSec: Number(process.env.PERMISSION_TIMEOUT ?? 900),

	/** Empty keeps the agent out of the host's user/project Claude settings. */
	settingSources: process.env.SETTING_SOURCES ?? '',

	/**
	 * Appended to the CLI's own system prompt. Sets the register for a shared
	 * chat: several humans read every answer, so length costs everyone.
	 */
	appendSystemPrompt:
		process.env.APPEND_SYSTEM_PROMPT ??
		[
			'Tu participes à une conversation de groupe : plusieurs personnes lisent tes réponses.',
			'Chaque message entrant est préfixé du pseudo de son auteur, entre crochets.',
			'Réponds en français, de façon brève et directe.',
			'Pas de préambule, pas de reformulation de la demande, pas de conclusion qui résume ce que tu viens de faire.',
			'Après une action, dis le résultat en une ou deux phrases — les fichiers modifiés et les commandes exécutées sont déjà affichés à côté, ne les réénumère pas.',
			'Développe seulement si on te le demande, ou si un point non évident mérite un avertissement.',
		].join(' '),

	maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 50) * 1024 * 1024,
}

/** Passed to every spawned `claude` process (agent turns, auth, status). */
export const claudeEnv: Record<string, string> = {
	MC_SERVER: config.internalUrl,
	...(process.env.CLAUDE_CONFIG_DIR
		? { CLAUDE_CONFIG_DIR: path.resolve(root, process.env.CLAUDE_CONFIG_DIR) }
		: {}),
}

mkdirSync(config.dataDir, { recursive: true })
mkdirSync(config.roomsDir, { recursive: true })
if (claudeEnv.CLAUDE_CONFIG_DIR) mkdirSync(claudeEnv.CLAUDE_CONFIG_DIR, { recursive: true })
