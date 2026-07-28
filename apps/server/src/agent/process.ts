import { config } from '../config.ts'
import { claudeBin } from './claude-bin.ts'
import type { CliMessage, UserInput } from './protocol.ts'

type Options = {
	roomId: string
	workdir: string
	sessionId: string
	/** `claude --model` alias; null keeps the account default. */
	model: string | null
	/** True when the session already exists on disk and must be resumed. */
	resumable: boolean
	onMessage: (message: CliMessage) => void
	onExit: (code: number | null, stderr: string) => void
}

/**
 * One long-lived `claude` process per room, driven over stream-json stdin/stdout.
 * A single process serves every turn of the room, so the conversation stays in
 * its context; if it dies we respawn with `--resume` on the same session id.
 */
export class ClaudeProcess {
	private proc: Bun.Subprocess<'pipe', 'pipe', 'pipe'> | null = null
	private stderrTail = ''
	private resumable: boolean
	private stopped = false

	constructor(private readonly options: Options) {
		this.resumable = options.resumable
	}

	get alive() {
		return this.proc !== null && this.proc.exitCode === null
	}

	get sessionId() {
		return this.options.sessionId
	}

	get model() {
		return this.options.model
	}

	/** Marks the session as replayable — set once the CLI has persisted a turn. */
	markResumable() {
		this.resumable = true
	}

	start() {
		if (this.alive) return
		this.stopped = false

		const args = [
			'--print',
			'--verbose',
			'--output-format',
			'stream-json',
			'--input-format',
			'stream-json',
			'--include-partial-messages',
			'--setting-sources',
			config.settingSources,
			'--settings',
			this.settings(),
			...(this.options.model ? ['--model', this.options.model] : []),
			...(this.resumable
				? ['--resume', this.options.sessionId]
				: ['--session-id', this.options.sessionId]),
		]

		this.proc = Bun.spawn([claudeBin, ...args], {
			cwd: this.options.workdir,
			stdin: 'pipe',
			stdout: 'pipe',
			stderr: 'pipe',
			env: { ...process.env, ...config.claudeEnv },
		})

		void this.pumpStdout()
		void this.pumpStderr()
		void this.proc.exited.then((code) => {
			this.proc = null
			if (!this.stopped) this.options.onExit(code, this.stderrTail)
		})
	}

	send(text: string) {
		if (!this.alive) this.start()
		const line: UserInput = {
			type: 'user',
			message: { role: 'user', content: [{ type: 'text', text }] },
		}
		this.proc?.stdin.write(`${JSON.stringify(line)}\n`)
		this.proc?.stdin.flush()
	}

	stop() {
		this.stopped = true
		try {
			this.proc?.stdin.end()
		} catch {
			// already closed
		}
		this.proc?.kill()
		this.proc = null
	}

	private settings() {
		const hook = `"${process.execPath.split('\\').join('/')}" "${config.permissionHookPath}" ${this.options.roomId}`
		return JSON.stringify({
			hooks: {
				PreToolUse: [
					{
						matcher: '*',
						hooks: [{ type: 'command', command: hook, timeout: config.permissionTimeoutSec }],
					},
				],
			},
		})
	}

	private async pumpStdout() {
		const proc = this.proc
		if (!proc) return
		let buffer = ''
		const decoder = new TextDecoder()
		for await (const chunk of proc.stdout) {
			buffer += decoder.decode(chunk, { stream: true })
			const lines = buffer.split('\n')
			buffer = lines.pop() ?? ''
			for (const line of lines) {
				if (!line.trim()) continue
				try {
					this.options.onMessage(JSON.parse(line) as CliMessage)
				} catch {
					// non-JSON noise on stdout, ignore
				}
			}
		}
	}

	private async pumpStderr() {
		const proc = this.proc
		if (!proc) return
		const decoder = new TextDecoder()
		for await (const chunk of proc.stderr) {
			this.stderrTail = `${this.stderrTail}${decoder.decode(chunk, { stream: true })}`.slice(-4000)
		}
	}
}
