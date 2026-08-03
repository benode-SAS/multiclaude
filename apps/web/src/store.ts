import type {
	AgentEvent,
	Attachment,
	AuthState,
	ContextUsage,
	Message,
	PermissionRequest,
	Presence,
	PresenceInput,
	QueuedItem,
	Room,
	RoomStatus,
	ServerMessage,
	SessionInfo,
} from '@multiclaude/shared'
import { create } from 'zustand'
import { api } from './lib/api.ts'
import { fetchSession, signIn, signOut, signUp } from './lib/auth-client.ts'
import { createSocket, type Socket } from './lib/socket.ts'
import {
	flashTitle,
	notifyEnabled,
	notifyPermission,
	playPermissionChime,
	setSoundEnabled,
	soundEnabled,
	toggleNotifications,
} from './lib/sound.ts'
import { applyTheme, storedTheme, type Theme } from './lib/theme.ts'

type State = {
	/** Display name, taken from the session; never chosen client-side. */
	pseudo: string
	session: SessionInfo | null
	authReady: boolean
	connected: boolean
	rooms: Room[]
	archived: Room[]
	activeRoomId: string | null
	room: Room | null
	messages: Message[]
	events: AgentEvent[]
	attachments: Attachment[]
	queue: QueuedItem[]
	pending: PermissionRequest[]
	participants: string[]
	typing: string[]
	/** Others' drafts, keyed by pseudo. Own draft lives in `draft`. */
	drafts: Record<string, string>
	draft: string
	presence: Record<string, Presence>
	/** Bumped per path when the workdir changes, to refetch what is on screen. */
	fileVersions: Record<string, number>
	filesRevision: number
	/** Pseudo whose view is being mirrored, if any. */
	following: string | null
	status: RoomStatus
	liveText: string
	loading: boolean
	error: string | null
	auth: AuthState | null
	authBusy: boolean
	usage: ContextUsage | null
	theme: Theme
	sound: boolean
	notify: boolean
}

type Actions = {
	init: () => Promise<void>
	signIn: (email: string, password: string) => Promise<void>
	signUp: (email: string, password: string, name: string) => Promise<void>
	signOut: () => Promise<void>
	refreshRooms: () => Promise<void>
	selectRoom: (roomId: string) => void
	createRoom: (input?: {
		title?: string
		repoUrl?: string
		branch?: string
		token?: string
	}) => Promise<void>
	forkRoom: (roomId: string, title?: string) => Promise<void>
	renameRoom: (roomId: string, title: string) => Promise<void>
	archiveRoom: (roomId: string) => Promise<void>
	restoreRoom: (roomId: string) => Promise<void>
	deleteRoomForever: (roomId: string) => Promise<void>
	loadArchived: () => Promise<void>
	sendMessage: (content: string, attachmentIds: string[]) => void
	setTyping: (typing: boolean) => void
	editMessage: (messageId: string, content: string) => void
	cancelQueued: (messageId: string) => void
	saveDraft: (content: string) => void
	reportPresence: (presence: PresenceInput) => void
	follow: (pseudo: string | null) => void
	stopTurn: () => void
	approve: (requestId: string, allow: boolean) => void
	setModel: (model: string | null) => void
	dismissError: () => void
	setTheme: (theme: Theme) => void
	toggleSound: () => void
	toggleNotify: () => Promise<void>
	refreshAuth: () => Promise<void>
	startLogin: () => Promise<void>
	submitCode: (code: string) => Promise<void>
	cancelLogin: () => Promise<void>
	logout: () => Promise<void>
}

let socket: Socket | null = null

const empty = {
	room: null,
	messages: [],
	events: [],
	attachments: [],
	queue: [],
	pending: [],
	participants: [],
	typing: [],
	drafts: {},
	draft: '',
	presence: {},
	following: null,
	fileVersions: {},
	filesRevision: 0,
	usage: null,
	status: 'idle' as RoomStatus,
	liveText: '',
}

export const useStore = create<State & Actions>((set, get) => {
	const applyServerMessage = (message: ServerMessage) => {
		const state = get()
		switch (message.type) {
			case 'snapshot': {
				const s = message.snapshot
				if (s.room.id !== state.activeRoomId) return
				set({
					room: s.room,
					messages: s.messages,
					events: s.events,
					attachments: s.attachments,
					queue: s.queue,
					pending: s.pending,
					participants: s.participants,
					typing: s.typing,
					draft: s.drafts.find((d) => d.pseudo === state.pseudo)?.content ?? '',
					drafts: Object.fromEntries(
						s.drafts.filter((d) => d.pseudo !== state.pseudo).map((d) => [d.pseudo, d.content]),
					),
					presence: Object.fromEntries(
						s.presence.filter((p) => p.pseudo !== state.pseudo).map((p) => [p.pseudo, p]),
					),
					following: null,
					status: s.room.status,
					liveText: s.liveTurn?.text ?? '',
					auth: s.auth,
					usage: s.usage,
					loading: false,
				})
				set({ rooms: state.rooms.map((r) => (r.id === s.room.id ? s.room : r)) })
				return
			}
			case 'message':
				if (message.message.roomId !== state.activeRoomId) return
				set({
					messages: [...state.messages, message.message],
					liveText: message.message.role === 'assistant' ? '' : state.liveText,
				})
				return
			case 'message_updated':
				set({
					messages: state.messages.map((m) => (m.id === message.message.id ? message.message : m)),
				})
				return
			case 'message_removed':
				set({
					messages: state.messages.filter((m) => m.id !== message.messageId),
					queue: state.queue.filter((q) => q.id !== message.messageId),
				})
				return
			case 'text_delta':
				set({ liveText: state.liveText + message.delta })
				return
			case 'event':
				if (message.event.roomId !== state.activeRoomId) return
				set({ events: [...state.events, message.event] })
				return
			case 'attachment': {
				if (message.attachment.roomId !== state.activeRoomId) return
				const rest = state.attachments.filter((a) => a.id !== message.attachment.id)
				set({ attachments: [...rest, message.attachment] })
				return
			}
			case 'file_change': {
				// An edit keeps the same path, so the version is what tells an open
				// viewer to refetch.
				set({
					filesRevision: state.filesRevision + 1,
					fileVersions: {
						...state.fileVersions,
						[message.relPath]: (state.fileVersions[message.relPath] ?? 0) + 1,
					},
					attachments:
						message.action === 'deleted'
							? state.attachments.filter((a) => a.relPath !== message.relPath)
							: state.attachments,
				})
				return
			}
			case 'permission_request':
				set({ pending: [...state.pending, message.request] })
				playPermissionChime()
				flashTitle('Permission requested')
				notifyPermission(
					state.room?.title ?? 'multiclaude',
					message.request.tool,
					message.request.reason,
				)
				return
			case 'permission_resolved':
				set({ pending: state.pending.filter((p) => p.requestId !== message.requestId) })
				return
			case 'status':
				set({ status: message.status })
				return
			case 'queued': {
				// Doubles as an update when a queued message is corrected.
				const others = state.queue.filter((q) => q.id !== message.item.id)
				set({ queue: [...others, message.item] })
				return
			}
			case 'dequeued':
				set({ queue: state.queue.filter((q) => q.id !== message.id) })
				return
			case 'turn_end':
				set({ liveText: '' })
				return
			case 'room_updated':
				set({
					room: state.room?.id === message.room.id ? message.room : state.room,
					rooms: state.rooms.map((r) => (r.id === message.room.id ? message.room : r)),
				})
				return
			case 'participants':
				set({ participants: message.participants })
				return
			case 'typing': {
				// Stop notices are broadcast to everyone, self included.
				if (message.pseudo === state.pseudo) return
				const others = state.typing.filter((p) => p !== message.pseudo)
				set({ typing: message.typing ? [...others, message.pseudo] : others })
				return
			}
			case 'draft': {
				const { pseudo, content } = message.draft
				if (pseudo === state.pseudo) return
				set({ drafts: { ...state.drafts, [pseudo]: content } })
				return
			}
			case 'presence': {
				if (message.presence.pseudo === state.pseudo) return
				set({ presence: { ...state.presence, [message.presence.pseudo]: message.presence } })
				return
			}
			case 'presence_left': {
				const { [message.pseudo]: _gone, ...rest } = state.presence
				set({
					presence: rest,
					following: state.following === message.pseudo ? null : state.following,
				})
				return
			}
			case 'auth':
				set({ auth: message.auth })
				return
			case 'usage':
				set({ usage: message.usage })
				return
			case 'error':
				set({ error: message.message })
				return
		}
	}

	const join = () => {
		const { activeRoomId } = get()
		if (!activeRoomId || !socket) return
		socket.send({ type: 'join', roomId: activeRoomId })
	}

	return {
		pseudo: '',
		session: null,
		authReady: false,
		connected: false,
		rooms: [],
		archived: [],
		activeRoomId: null,
		loading: false,
		error: null,
		auth: null,
		authBusy: false,
		theme: storedTheme(),
		sound: soundEnabled(),
		notify: notifyEnabled(),
		...empty,

		async init() {
			const session = await fetchSession().catch(() => null)
			set({ session, authReady: true, pseudo: session?.user?.name ?? '' })
			if (!session?.user) return

			if (!socket) {
				socket = createSocket({
					onMessage: applyServerMessage,
					onStatusChange: (connected) => set({ connected }),
				})
				socket.onOpen = join
			}
			await get().refreshAuth()
			await get().refreshRooms()
			const first = get().rooms[0]
			if (first) get().selectRoom(first.id)
		},

		async signIn(email, password) {
			await signIn(email, password)
			await get().init()
		},

		async signUp(email, password, name) {
			await signUp(email, password, name)
			await get().init()
		},

		async signOut() {
			await signOut()
			socket?.close()
			socket = null
			set({ session: null, pseudo: '', activeRoomId: null, rooms: [], ...empty })
			await get().init()
		},

		async refreshRooms() {
			set({ rooms: await api.rooms() })
		},

		selectRoom(roomId) {
			if (get().activeRoomId === roomId) return
			set({ activeRoomId: roomId, loading: true, ...empty })
			join()
		},

		async createRoom(input) {
			const room = await api.createRoom(input)
			set({ rooms: [room, ...get().rooms] })
			get().selectRoom(room.id)
		},

		async forkRoom(roomId, title) {
			const room = await api.forkRoom(roomId, title)
			set({ rooms: [room, ...get().rooms] })
			get().selectRoom(room.id)
		},

		async renameRoom(roomId, title) {
			const room = await api.renameRoom(roomId, title)
			set({
				rooms: get().rooms.map((r) => (r.id === roomId ? room : r)),
				room: get().room?.id === roomId ? room : get().room,
			})
		},

		async loadArchived() {
			set({ archived: await api.archivedRooms() })
		},

		async restoreRoom(roomId) {
			const room = await api.restoreRoom(roomId)
			set({
				archived: get().archived.filter((r) => r.id !== roomId),
				rooms: [room, ...get().rooms],
			})
			get().selectRoom(room.id)
		},

		async deleteRoomForever(roomId) {
			await api.deleteRoomForever(roomId)
			set({ archived: get().archived.filter((r) => r.id !== roomId) })
		},

		async archiveRoom(roomId) {
			const room = await api.archiveRoom(roomId)
			set({ archived: [room, ...get().archived] })
			const rooms = get().rooms.filter((r) => r.id !== roomId)
			set({ rooms })
			if (get().activeRoomId !== roomId) return
			set({ activeRoomId: null, ...empty })
			const next = rooms[0]
			if (next) get().selectRoom(next.id)
			else await get().createRoom()
		},

		sendMessage(content, attachmentIds) {
			const { activeRoomId } = get()
			if (!activeRoomId || !socket) return
			set({ draft: '' })
			socket.send({ type: 'message', roomId: activeRoomId, content, attachmentIds })
		},

		editMessage(messageId, content) {
			const { activeRoomId } = get()
			if (!activeRoomId || !socket) return
			socket.send({ type: 'edit_message', roomId: activeRoomId, messageId, content })
		},

		cancelQueued(messageId) {
			const { activeRoomId } = get()
			if (!activeRoomId || !socket) return
			socket.send({ type: 'cancel_queued', roomId: activeRoomId, messageId })
		},

		stopTurn() {
			const { activeRoomId } = get()
			if (!activeRoomId || !socket) return
			socket.send({ type: 'stop', roomId: activeRoomId })
		},

		saveDraft(content) {
			const { activeRoomId } = get()
			set({ draft: content })
			if (!activeRoomId || !socket) return
			socket.send({ type: 'draft', roomId: activeRoomId, content })
		},

		reportPresence(presence) {
			const { activeRoomId } = get()
			if (!activeRoomId || !socket) return
			socket.send({ type: 'presence', roomId: activeRoomId, presence })
		},

		follow(pseudo) {
			set({ following: pseudo })
		},

		setTyping(isTyping) {
			const { activeRoomId } = get()
			if (!activeRoomId || !socket) return
			socket.send({ type: 'typing', roomId: activeRoomId, typing: isTyping })
		},

		approve(requestId, allow) {
			const { activeRoomId } = get()
			if (!activeRoomId || !socket) return
			socket.send({ type: 'approve', roomId: activeRoomId, requestId, allow })
		},

		setModel(model) {
			const { activeRoomId } = get()
			if (!activeRoomId || !socket) return
			socket.send({ type: 'set_model', roomId: activeRoomId, model })
		},

		dismissError() {
			set({ error: null })
		},

		setTheme(theme) {
			applyTheme(theme)
			set({ theme })
		},

		async toggleNotify() {
			const granted = await toggleNotifications(!get().notify)
			set({ notify: granted })
		},

		toggleSound() {
			const sound = !get().sound
			setSoundEnabled(sound)
			set({ sound })
			if (sound) playPermissionChime()
		},

		async refreshAuth() {
			set({ auth: await api.auth() })
		},

		async startLogin() {
			set({ authBusy: true })
			try {
				set({ auth: await api.startLogin() })
			} finally {
				set({ authBusy: false })
			}
		},

		async submitCode(code) {
			set({ authBusy: true })
			try {
				set({ auth: await api.submitCode(code) })
			} finally {
				set({ authBusy: false })
			}
		},

		async cancelLogin() {
			set({ auth: await api.cancelLogin() })
		},

		async logout() {
			set({ auth: await api.logout() })
		},
	}
})
