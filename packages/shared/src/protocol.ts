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
	/** Room this one was forked from, if any. */
	forkedFrom: string | null
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
	editedAt?: number | null
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

/** A participant's in-progress message, shared so others can peek at it. */
export type Draft = {
	pseudo: string
	content: string
	updatedAt: number
}

/**
 * A selection expressed as character offsets inside a named container, so each
 * client can rebuild the exact range in its own DOM — the rendered markup
 * differs between viewports, a pixel rectangle would not survive the trip.
 */
export type SelectionAnchor = {
	/** 'message' targets a chat bubble, 'viewer' the open document. */
	scope: 'message' | 'viewer'
	/** Message id, or file path for the viewer. */
	key: string
	start: number
	end: number
	text: string
}

/**
 * Where someone is and what they are looking at. Ephemeral and throttled:
 * enough to follow along, not a keystroke log.
 */
export type Presence = {
	pseudo: string
	view: 'chat' | 'file'
	/** Path of the file open in their viewer, when `view` is 'file'. */
	filePath: string | null
	/** Scroll position of their active pane, 0 to 1. */
	scroll: number
	selection: SelectionAnchor | null
	updatedAt: number
}

export type PresenceInput = Omit<Presence, 'pseudo' | 'updatedAt'>

export type ContextUsage = {
	/** Tokens sent on the last request: what actually occupies the context. */
	tokens: number
	/** The active model's context window, as reported by the CLI. */
	window: number
	model: string
	costUsd: number
	updatedAt: number
}

export type Role = 'admin' | 'member'

export type AccountSummary = {
	id: string
	name: string
	email: string
	role: Role
	createdAt: number
	/** Signed in with a temporary password: nothing else until it is replaced. */
	mustChangePassword: boolean
}

/** The temporary password is returned once, for the admin to pass on. */
export type CreatedAccount = { account: AccountSummary; temporaryPassword: string }

/** What the front needs before it can even render a sign-in screen. */
export type SessionInfo = {
	user: AccountSummary | null
	/** No account exists yet: the first one created will be an admin. */
	needsSetup: boolean
	signupEnabled: boolean
}

export const isAdmin = (user: AccountSummary | null | undefined) => user?.role === 'admin'

/** Settings editable from the UI; they take precedence over the `.env`. */
export type AdminSettings = {
	signupEnabled: boolean
	/** Applied to new conversations; null keeps the account default. */
	defaultModel: string | null
}

/** Environment-derived, shown for diagnosis and not editable from the UI. */
export type AdminRuntime = {
	publicUrl: string
	dataDir: string
	serveWeb: boolean
	signupFromEnv: boolean
	permissionTimeoutSec: number
	alwaysAskTools: string[]
	askPatterns: string[]
	cloneDepth: number
	maxUploadMb: number
	claudeBin: string
	claudeLoggedIn: boolean
	accounts: number
	rooms: number
	uptimeSec: number
}

export type AdminConfig = { settings: AdminSettings; runtime: AdminRuntime }

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
	| { type: 'join'; roomId: string }
	| { type: 'message'; roomId: string; content: string; attachmentIds?: string[] }
	| { type: 'approve'; roomId: string; requestId: string; allow: boolean }
	| { type: 'rename'; roomId: string; title: string }
	| { type: 'set_model'; roomId: string; model: string | null }
	| { type: 'typing'; roomId: string; typing: boolean }
	| { type: 'stop'; roomId: string }
	| { type: 'edit_message'; roomId: string; messageId: string; content: string }
	| { type: 'cancel_queued'; roomId: string; messageId: string }
	| { type: 'draft'; roomId: string; content: string }
	| { type: 'presence'; roomId: string; presence: PresenceInput }
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
	/** Every participant's draft, including the joiner's own. */
	drafts: Draft[]
	presence: Presence[]
	liveTurn: { turnId: string; text: string } | null
	auth: AuthState
	usage: ContextUsage | null
}

export type ServerMessage =
	| { type: 'snapshot'; snapshot: Snapshot }
	| { type: 'message'; message: Message }
	| { type: 'message_updated'; message: Message }
	| { type: 'message_removed'; messageId: string }
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
	| { type: 'draft'; draft: Draft }
	| { type: 'presence'; presence: Presence }
	| { type: 'presence_left'; pseudo: string }
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
