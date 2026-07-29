export type RoomStatus = 'idle' | 'running'
export type MessageRole = 'user' | 'assistant' | 'system'
export type EventType = 'tool_use' | 'tool_result' | 'file_change' | 'text'
export type AttachmentSource = 'user' | 'claude'
export type FileAction = 'created' | 'modified' | 'deleted'

export type Room = {
	id: string
	title: string
	sessionId: string | null
	/** `claude --model` alias; null keeps the account default. */
	model: string | null
	workdir: string
	status: RoomStatus
	createdAt: number
	updatedAt: number
}

export const MODELS = [
	{ id: null, label: 'Défaut du compte' },
	{ id: 'opus', label: 'Opus 5' },
	{ id: 'sonnet', label: 'Sonnet 5' },
	{ id: 'haiku', label: 'Haiku 4.5' },
	{ id: 'fable', label: 'Fable 5' },
] as const satisfies ReadonlyArray<{ id: string | null; label: string }>

export const modelLabel = (id: string | null) =>
	MODELS.find((m) => m.id === id)?.label ?? id ?? 'Défaut du compte'

export type Message = {
	id: string
	roomId: string
	author: string
	role: MessageRole
	content: string
	createdAt: number
}

export type ToolUsePayload = {
	toolUseId: string
	name: string
	input: Record<string, unknown>
}

export type ToolResultPayload = {
	toolUseId: string
	isError: boolean
	content: string
}

export type AgentEvent = {
	id: string
	roomId: string
	turnId: string
	seq: number
	type: EventType
	payload: ToolUsePayload | ToolResultPayload | Record<string, unknown>
	createdAt: number
}

export type Attachment = {
	id: string
	roomId: string
	messageId: string | null
	source: AttachmentSource
	filename: string
	relPath: string
	mime: string
	size: number
	createdAt: number
}

export type QueuedItem = {
	id: string
	pseudo: string
	content: string
}

export type PermissionRequest = {
	requestId: string
	tool: string
	input: Record<string, unknown>
	/** Why the policy stopped on this call, shown on the approval card. */
	reason: string
}

export type ContextUsage = {
	/** Tokens sent on the last request: what actually occupies the context. */
	tokens: number
	/** The active model's context window, as reported by the CLI. */
	window: number
	model: string
	costUsd: number
	updatedAt: number
}

export type AuthState = {
	loggedIn: boolean
	email: string | null
	method: string | null
	plan: string | null
	/** Set while a login is in flight: the URL the human must open. */
	loginUrl: string | null
	pending: boolean
	error: string | null
}

export type ClientMessage =
	| { type: 'join'; roomId: string; pseudo: string }
	| { type: 'message'; roomId: string; pseudo: string; content: string; attachmentIds?: string[] }
	| { type: 'approve'; roomId: string; requestId: string; allow: boolean }
	| { type: 'rename'; roomId: string; title: string }
	| { type: 'set_model'; roomId: string; model: string | null }
	| { type: 'typing'; roomId: string; pseudo: string; typing: boolean }
	| { type: 'stop'; roomId: string }
	| { type: 'ping' }

export type Snapshot = {
	room: Room
	messages: Message[]
	events: AgentEvent[]
	attachments: Attachment[]
	queue: QueuedItem[]
	pending: PermissionRequest[]
	participants: string[]
	typing: string[]
	liveTurn: { turnId: string; text: string } | null
	auth: AuthState
	usage: ContextUsage | null
}

export type ServerMessage =
	| { type: 'snapshot'; snapshot: Snapshot }
	| { type: 'message'; message: Message }
	| { type: 'text_delta'; turnId: string; delta: string }
	| { type: 'event'; event: AgentEvent }
	| { type: 'file_change'; action: FileAction; relPath: string; size: number; mime: string }
	| { type: 'attachment'; attachment: Attachment }
	| { type: 'permission_request'; request: PermissionRequest }
	| { type: 'permission_resolved'; requestId: string; allow: boolean; by: string }
	| { type: 'status'; status: RoomStatus }
	| { type: 'queued'; item: QueuedItem }
	| { type: 'dequeued'; id: string }
	| { type: 'turn_end'; turnId: string }
	| { type: 'room_updated'; room: Room }
	| { type: 'participants'; participants: string[] }
	| { type: 'typing'; pseudo: string; typing: boolean }
	| { type: 'auth'; auth: AuthState }
	| { type: 'usage'; usage: ContextUsage }
	| { type: 'error'; message: string }

export type FileEntry = {
	relPath: string
	name: string
	size: number
	mime: string
	modifiedAt: number
}
