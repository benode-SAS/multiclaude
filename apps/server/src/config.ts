import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

	/**
	 * Serve the built front from this server so everything lives on one port.
	 * On by default: in production the build is the only front there is, and in
	 * dev vite answers on its own port anyway. SERVE_WEB=false forces it off.
	 */
	serveWeb: bool(process.env.SERVE_WEB, true),
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

	/** Public URL, used by the session cookies and the trusted origins. */
	get publicUrl() {
		return process.env.PUBLIC_URL ?? `http://localhost:${port}`
	},
	get trustedOrigins() {
		const extra = (process.env.TRUSTED_ORIGINS ?? '')
			.split(',')
			.map((o) => o.trim())
			.filter(Boolean)
		return [config.publicUrl, ...extra]
	},
	/** Session signing secret, see resolveAuthSecret below. */
	authSecret: '',
	/** Signups open to anyone, or accounts created by an admin only. */
	signupEnabled: bool(process.env.SIGNUP_ENABLED, true),
	/** Admin account created at boot while no account exists yet. */
	adminEmail: process.env.ADMIN_EMAIL?.trim() ?? '',
	adminPassword: process.env.ADMIN_PASSWORD ?? '',
	adminName: process.env.ADMIN_NAME?.trim() || 'Admin',

	/** Clone depth; 0 for the full history. */
	cloneDepth: Number(process.env.CLONE_DEPTH ?? 1),
	cloneTimeoutMs: Number(process.env.CLONE_TIMEOUT ?? 180) * 1000,
	/** Fallback token for private https repositories, when none is typed in. */
	gitToken: process.env.GIT_TOKEN?.trim() ?? '',
	/** SSH key used for private repositories over ssh, e.g. a deploy key. */
	gitSshKey: process.env.GIT_SSH_KEY?.trim() ?? '',
}

/**
 * Kept out of the agent's environment. It runs shell commands on request, so
 * anything left in there is readable by anyone who can type in the chat.
 */
const SECRET_ENV = ['AUTH_SECRET', 'ADMIN_PASSWORD', 'GIT_TOKEN']

export function agentEnv(): Record<string, string | undefined> {
	const env = { ...process.env }
	for (const key of SECRET_ENV) delete env[key]
	return env
}

/** Passed to every spawned `claude` process (agent turns, auth, status). */
export const claudeEnv: Record<string, string> = {
	MC_SERVER: config.internalUrl,
	...(process.env.CLAUDE_CONFIG_DIR
		? { CLAUDE_CONFIG_DIR: path.resolve(root, process.env.CLAUDE_CONFIG_DIR) }
		: {}),
}

/**
 * A missing secret would invalidate every session on each restart. One is
 * generated and kept in DATA_DIR instead: the app starts with no configuration
 * at all, and sessions still survive.
 */
function resolveAuthSecret() {
	const fromEnv = process.env.AUTH_SECRET?.trim()
	if (fromEnv) return fromEnv

	const file = path.join(dataDir, '.auth-secret')
	if (existsSync(file)) return readFileSync(file, 'utf8').trim()

	const generated = randomBytes(32).toString('hex')
	mkdirSync(dataDir, { recursive: true })
	writeFileSync(file, generated, { mode: 0o600 })
	console.warn('[auth] AUTH_SECRET absent : secret généré dans DATA_DIR/.auth-secret')
	return generated
}

mkdirSync(config.dataDir, { recursive: true })
mkdirSync(config.roomsDir, { recursive: true })
if (claudeEnv.CLAUDE_CONFIG_DIR) mkdirSync(claudeEnv.CLAUDE_CONFIG_DIR, { recursive: true })

config.authSecret = resolveAuthSecret()
