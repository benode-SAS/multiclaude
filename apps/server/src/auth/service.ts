import type { AuthState } from '@multiclaude/shared'
import { claudeBin } from '../agent/claude-bin.ts'
import { claudeEnv, config } from '../config.ts'

type LoginSession = {
	proc: Bun.Subprocess<'pipe', 'pipe', 'pipe'>
	url: string | null
	error: string | null
}

const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)
const OSC8 = new RegExp(`${ESC}\\]8;;[^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)`, 'g')
const ANSI = new RegExp(`${ESC}\\[[0-9;?]*[a-zA-Z]`, 'g')
const AUTHORIZE_URL = /https:\/\/\S*oauth\/authorize\S*/

/** The CLI wraps its URLs in terminal escapes; strip them to get plain text. */
const clean = (raw: string) => raw.replace(OSC8, '').replace(ANSI, '')

let login: LoginSession | null = null
let listeners: Array<(state: AuthState) => void> = []

async function readStatus(): Promise<AuthState> {
	const proc = Bun.spawn([claudeBin, 'auth', 'status', '--json'], {
		cwd: config.dataDir,
		env: { ...process.env, ...claudeEnv },
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const out = await new Response(proc.stdout).text()
	await proc.exited

	const base = {
		loginUrl: login?.url ?? null,
		pending: login !== null,
		error: login?.error ?? null,
	}
	try {
		const parsed = JSON.parse(clean(out).trim()) as {
			loggedIn?: boolean
			email?: string
			authMethod?: string
			subscriptionType?: string
		}
		return {
			...base,
			loggedIn: parsed.loggedIn === true,
			email: parsed.email ?? null,
			method: parsed.authMethod ?? null,
			plan: parsed.subscriptionType ?? null,
		}
	} catch {
		return {
			...base,
			loggedIn: false,
			email: null,
			method: null,
			plan: null,
			error: base.error ?? 'statut du CLI claude illisible',
		}
	}
}

async function publish() {
	const state = await readStatus()
	for (const listener of listeners) listener(state)
	return state
}

export const AuthService = {
	subscribe(listener: (state: AuthState) => void) {
		listeners.push(listener)
		return () => {
			listeners = listeners.filter((l) => l !== listener)
		}
	},

	status: readStatus,

	/** Spawns `claude auth login` and captures the authorize URL it prints. */
	async startLogin(): Promise<AuthState> {
		if (login) return readStatus()

		const proc = Bun.spawn([claudeBin, 'auth', 'login', '--claudeai'], {
			cwd: config.dataDir,
			env: { ...process.env, ...claudeEnv },
			stdin: 'pipe',
			stdout: 'pipe',
			stderr: 'pipe',
		})
		const session: LoginSession = { proc, url: null, error: null }
		login = session

		const scan = async (stream: ReadableStream<Uint8Array>) => {
			const decoder = new TextDecoder()
			let buffer = ''
			for await (const chunk of stream) {
				buffer = clean(buffer + decoder.decode(chunk, { stream: true })).slice(-8000)
				const match = buffer.match(AUTHORIZE_URL)
				if (match?.[0] && !session.url) {
					session.url = match[0]
					void publish()
				}
			}
		}

		void scan(proc.stdout)
		void scan(proc.stderr)
		void proc.exited.then(() => {
			if (login === session) login = null
			void publish()
		})

		for (let i = 0; i < 60 && !session.url; i++) await Bun.sleep(150)
		return readStatus()
	},

	/** Feeds the code pasted back by the human into the waiting login process. */
	async submitCode(raw: string): Promise<AuthState> {
		const session = login
		if (!session) return readStatus()

		session.error = null
		session.proc.stdin.write(`${extractCode(raw)}\n`)
		session.proc.stdin.flush()
		await Promise.race([session.proc.exited, Bun.sleep(30000)])

		const state = await publish()
		if (!state.loggedIn && !state.pending) {
			return { ...state, error: 'code refusé, relance la connexion' }
		}
		return state
	},

	async cancelLogin() {
		login?.proc.kill()
		login = null
		return publish()
	},

	async logout() {
		const proc = Bun.spawn([claudeBin, 'auth', 'logout'], {
			cwd: config.dataDir,
			env: { ...process.env, ...claudeEnv },
			stdout: 'pipe',
			stderr: 'pipe',
		})
		await proc.exited
		return publish()
	},
}

/** Accepts the raw code or the whole redirect URL it was pasted from. */
export function extractCode(raw: string) {
	const value = raw.trim()
	if (!value.includes('://')) return value
	try {
		const url = new URL(value)
		const code = url.searchParams.get('code')
		if (!code) return value
		const state = url.searchParams.get('state')
		return state ? `${code}#${state}` : code
	} catch {
		return value
	}
}
