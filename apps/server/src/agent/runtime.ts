import type { Attachment, PermissionRequest, QueuedItem, Room } from '@multiclaude/shared'
import { AuthService } from '../auth/service.ts'
import { config } from '../config.ts'
import type { FileChange } from '../files/watcher.ts'
import { watchWorkdir } from '../files/watcher.ts'
import { newId } from '../lib/ids.ts'
import { RoomService } from '../rooms/service.ts'
import { hub } from '../ws/hub.ts'
import { classify } from './policy.ts'
import { ClaudeProcess } from './process.ts'
import type { CliMessage, ContentBlock } from './protocol.ts'

type Submission = {
	messageId: string
	pseudo: string
	content: string
	attachments: Attachment[]
}

type PendingPermission = {
	request: PermissionRequest
	resolve: (decision: { allow: boolean; reason?: string }) => void
}

function textOfToolResult(content: unknown): string {
	if (typeof content === 'string') return content
	if (Array.isArray(content)) {
		return content
			.map((block) => {
				if (typeof block === 'string') return block
				if (block && typeof block === 'object' && 'text' in block) return String(block.text)
				if (block && typeof block === 'object' && 'type' in block) return `[${String(block.type)}]`
				return ''
			})
			.filter(Boolean)
			.join('\n')
	}
	return content == null ? '' : JSON.stringify(content)
}

function buildPrompt(submission: Submission) {
	const files = submission.attachments.map((a) => `(fichier joint: ${a.relPath})`).join(' ')
	const header = files ? `[${submission.pseudo}] ${files}` : `[${submission.pseudo}]`
	return `${header}: ${submission.content}`
}

export class RoomRuntime {
	readonly roomId: string
	private workdir = ''
	private process: ClaudeProcess | null = null
	private queue: Submission[] = []
	private running = false
	private stopWatcher: (() => void) | null = null
	private pending = new Map<string, PendingPermission>()
	private liveTurn: { turnId: string; text: string } | null = null
	private turnId = ''
	private seq = 0
	private producedText = false
	private endTurn: ((error?: string) => void) | null = null
	private interruptedBy: string | null = null

	constructor(roomId: string) {
		this.roomId = roomId
	}

	start(room: Room) {
		this.workdir = room.workdir
		this.stopWatcher = watchWorkdir(room.workdir, (change) => {
			this.onFileChange(room, change).catch((error) => console.error('[watcher]', error))
		})
	}

	dispose() {
		this.stopWatcher?.()
		this.stopWatcher = null
		for (const { resolve } of this.pending.values()) {
			resolve({ allow: false, reason: 'room fermée' })
		}
		this.pending.clear()
		this.process?.stop()
		this.process = null
	}

	state() {
		return {
			queue: this.queue.map<QueuedItem>((s) => ({
				id: s.messageId,
				pseudo: s.pseudo,
				content: s.content,
			})),
			pending: [...this.pending.values()].map((p) => p.request),
			liveTurn: this.liveTurn,
		}
	}

	/**
	 * Interrupts the running turn. Queued messages are left alone — they are
	 * other people's asks, not part of what is being stopped.
	 */
	async stop(by: string) {
		if (!this.running || !this.process?.alive) return false

		this.interruptedBy = by
		// A tool waiting on a human would otherwise keep the CLI blocked.
		for (const [requestId, entry] of this.pending) {
			hub.broadcast(this.roomId, { type: 'permission_resolved', requestId, allow: false, by })
			entry.resolve({ allow: false, reason: `interrompu par ${by}` })
		}
		this.pending.clear()

		const sent = this.process.interrupt(newId())
		if (!sent) {
			this.endTurn?.(undefined)
			return false
		}

		// If the CLI does not wind down, drop the process; the next turn resumes.
		setTimeout(() => {
			if (this.interruptedBy && this.running) {
				this.process?.stop()
				this.process = null
				this.endTurn?.(undefined)
			}
		}, 8000)
		return true
	}

	approve(requestId: string, allow: boolean, by: string) {
		const entry = this.pending.get(requestId)
		if (!entry) return
		this.pending.delete(requestId)
		hub.broadcast(this.roomId, { type: 'permission_resolved', requestId, allow, by })
		entry.resolve({ allow, reason: allow ? undefined : `refusé par ${by}` })
	}

	/** Called by the PreToolUse hook; blocks until a human clicks. */
	requestPermission(tool: string, input: Record<string, unknown>) {
		const decision = classify(tool, input, {
			workdir: this.workdir,
			alwaysAsk: config.alwaysAskTools,
			extraPatterns: config.askPatterns,
		})
		if (decision.allow) return Promise.resolve({ allow: true })

		const request: PermissionRequest = { requestId: newId(), tool, input, reason: decision.reason }
		return new Promise<{ allow: boolean; reason?: string }>((resolve) => {
			this.pending.set(request.requestId, { request, resolve })
			hub.broadcast(this.roomId, { type: 'permission_request', request })
		})
	}

	async submit(input: { pseudo: string; content: string; attachmentIds?: string[] }) {
		const room = await RoomService.get(this.roomId)
		if (!room) return

		const attached = await RoomService.attachmentsByIds(this.roomId, input.attachmentIds ?? [])
		const message = await RoomService.addMessage({
			roomId: this.roomId,
			author: input.pseudo,
			role: 'user',
			content: input.content,
		})
		if (attached.length) {
			await RoomService.linkAttachments(
				attached.map((a) => a.id),
				message.id,
			)
		}

		hub.broadcast(this.roomId, { type: 'message', message })
		for (const attachment of attached) {
			hub.broadcast(this.roomId, {
				type: 'attachment',
				attachment: { ...attachment, messageId: message.id },
			})
		}

		const submission: Submission = {
			messageId: message.id,
			pseudo: input.pseudo,
			content: input.content,
			attachments: attached,
		}

		if (this.running) {
			this.queue.push(submission)
			hub.broadcast(this.roomId, {
				type: 'queued',
				item: { id: message.id, pseudo: input.pseudo, content: input.content },
			})
			return
		}

		void this.drain(submission)
	}

	private async drain(first: Submission) {
		this.running = true
		await RoomService.setStatus(this.roomId, 'running')
		hub.broadcast(this.roomId, { type: 'status', status: 'running' })

		let current: Submission | undefined = first
		while (current) {
			try {
				await this.runTurn(current)
			} catch (error) {
				await this.fail(error instanceof Error ? error.message : String(error))
			}
			current = this.queue.shift()
			if (current) hub.broadcast(this.roomId, { type: 'dequeued', id: current.messageId })
		}

		this.running = false
		this.liveTurn = null
		await RoomService.setStatus(this.roomId, 'idle')
		hub.broadcast(this.roomId, { type: 'status', status: 'idle' })

		const updated = await RoomService.get(this.roomId)
		if (updated) hub.broadcast(this.roomId, { type: 'room_updated', room: updated })
	}

	private async fail(text: string) {
		const message = await RoomService.addMessage({
			roomId: this.roomId,
			author: 'system',
			role: 'system',
			content: text,
		})
		hub.broadcast(this.roomId, { type: 'message', message })
		hub.broadcast(this.roomId, { type: 'error', message: text })
	}

	private async runTurn(submission: Submission) {
		const room = await RoomService.get(this.roomId)
		if (!room) return

		const auth = await AuthService.status()
		hub.broadcast(this.roomId, { type: 'auth', auth })
		if (!auth.loggedIn) {
			await this.fail('Claude Code n’est pas connecté — lance la connexion depuis le bandeau.')
			return
		}

		await this.ensureProcess(room)

		this.turnId = newId()
		this.liveTurn = { turnId: this.turnId, text: '' }
		this.seq = 0
		this.producedText = false
		this.interruptedBy = null

		const finished = new Promise<string | undefined>((resolve) => {
			this.endTurn = resolve
		})

		this.process?.send(buildPrompt(submission))
		const error = await finished
		this.endTurn = null
		this.liveTurn = null

		hub.broadcast(this.roomId, { type: 'turn_end', turnId: this.turnId })

		const stoppedBy = this.interruptedBy
		this.interruptedBy = null
		if (stoppedBy) {
			const message = await RoomService.addMessage({
				roomId: this.roomId,
				author: 'system',
				role: 'system',
				content: `⏹ Turn interrompu par ${stoppedBy}.`,
			})
			hub.broadcast(this.roomId, { type: 'message', message })
			return
		}
		if (error) await this.fail(error)
	}

	/**
	 * The CLI takes its model at spawn, so a switch drops the process. The
	 * session id is kept, so the next turn resumes the same conversation.
	 */
	async setModel(model: string | null) {
		const room = await RoomService.setModel(this.roomId, model)
		if (!room) return null
		if (!this.running) {
			this.process?.stop()
			this.process = null
		}
		hub.broadcast(this.roomId, { type: 'room_updated', room })
		return room
	}

	private async ensureProcess(room: Room) {
		if (this.process && this.process.model !== room.model) {
			this.process.stop()
			this.process = null
		}
		if (this.process?.alive) return

		let sessionId = room.sessionId
		const resumable = Boolean(sessionId)
		if (!sessionId) {
			sessionId = crypto.randomUUID()
			await RoomService.setSessionId(room.id, sessionId)
		}

		this.process = new ClaudeProcess({
			roomId: room.id,
			workdir: room.workdir,
			sessionId,
			model: room.model,
			resumable,
			onMessage: (message) => {
				this.handle(message).catch((err) => console.error('[cli]', err))
			},
			onExit: (code, stderr) => {
				this.process = null
				const detail = stderr.trim().split('\n').filter(Boolean).at(-1) ?? ''
				this.endTurn?.(`le process claude s’est arrêté (code ${code}) ${detail}`.trim())
			},
		})
		this.process.start()
	}

	private async handle(message: CliMessage) {
		if (message.type === 'system') {
			if (message.subtype === 'init' && typeof message.session_id === 'string') {
				await RoomService.setSessionId(this.roomId, message.session_id)
			}
			return
		}

		if (message.type === 'stream_event') {
			const event = message.event
			if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
				const delta = event.delta.text ?? ''
				if (this.liveTurn) this.liveTurn.text += delta
				hub.broadcast(this.roomId, { type: 'text_delta', turnId: this.turnId, delta })
			}
			return
		}

		if (message.type === 'assistant') {
			for (const block of message.message.content) await this.handleAssistantBlock(block)
			return
		}

		if (message.type === 'user') {
			const content = message.message.content
			if (!Array.isArray(content)) return
			for (const block of content) {
				if (block.type !== 'tool_result') continue
				const event = await RoomService.addEvent({
					roomId: this.roomId,
					turnId: this.turnId,
					seq: this.seq++,
					type: 'tool_result',
					payload: {
						toolUseId: String(block.tool_use_id),
						isError: block.is_error === true,
						content: textOfToolResult(block.content).slice(0, 20000),
					},
				})
				hub.broadcast(this.roomId, { type: 'event', event })
			}
			return
		}

		if (message.type === 'result') {
			this.process?.markResumable()
			const text = message.result ?? ''
			if (!this.producedText && text.trim()) {
				const persisted = await RoomService.addMessage({
					roomId: this.roomId,
					author: 'claude',
					role: 'assistant',
					content: text,
				})
				hub.broadcast(this.roomId, { type: 'message', message: persisted })
			}
			// An interrupt lands here as an error; it is not one.
			const failed = message.is_error && !this.interruptedBy
			this.endTurn?.(failed ? text || 'le turn a échoué' : undefined)
		}
	}

	private async handleAssistantBlock(block: ContentBlock) {
		if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
			this.producedText = true
			const persisted = await RoomService.addMessage({
				roomId: this.roomId,
				author: 'claude',
				role: 'assistant',
				content: block.text,
			})
			if (this.liveTurn) this.liveTurn.text = ''
			hub.broadcast(this.roomId, { type: 'message', message: persisted })
			return
		}

		if (block.type === 'tool_use') {
			const event = await RoomService.addEvent({
				roomId: this.roomId,
				turnId: this.turnId,
				seq: this.seq++,
				type: 'tool_use',
				payload: {
					toolUseId: String(block.id),
					name: String(block.name),
					input: (block.input ?? {}) as Record<string, unknown>,
				},
			})
			hub.broadcast(this.roomId, { type: 'event', event })
		}
	}

	private async onFileChange(room: Room, change: FileChange) {
		if (change.action === 'deleted') {
			await RoomService.removeAttachmentByPath(room.id, change.relPath)
		} else {
			const attachment = await RoomService.upsertAttachment({
				roomId: room.id,
				messageId: null,
				source: 'claude',
				filename: change.relPath.split('/').pop() ?? change.relPath,
				relPath: change.relPath,
				mime: change.mime,
				size: change.size,
			})
			hub.broadcast(room.id, { type: 'attachment', attachment })
		}
		hub.broadcast(room.id, {
			type: 'file_change',
			action: change.action,
			relPath: change.relPath,
			size: change.size,
			mime: change.mime,
		})
	}
}

const runtimes = new Map<string, RoomRuntime>()

export async function getRuntime(roomId: string): Promise<RoomRuntime | null> {
	const existing = runtimes.get(roomId)
	if (existing) return existing
	const room = await RoomService.get(roomId)
	if (!room) return null
	const runtime = new RoomRuntime(roomId)
	runtimes.set(roomId, runtime)
	runtime.start(room)
	return runtime
}

export function disposeRuntime(roomId: string) {
	runtimes.get(roomId)?.dispose()
	runtimes.delete(roomId)
}

export function disposeAll() {
	for (const runtime of runtimes.values()) runtime.dispose()
	runtimes.clear()
}
