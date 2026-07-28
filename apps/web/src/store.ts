import type {
	AgentEvent,
	Attachment,
	AuthState,
	Message,
	PermissionRequest,
	QueuedItem,
	Room,
	RoomStatus,
	ServerMessage,
} from '@multiclaude/shared'
import { create } from 'zustand'
import { api } from './lib/api.ts'
import { createSocket, type Socket } from './lib/socket.ts'

type State = {
	pseudo: string
	connected: boolean
	rooms: Room[]
	activeRoomId: string | null
	room: Room | null
	messages: Message[]
	events: AgentEvent[]
	attachments: Attachment[]
	queue: QueuedItem[]
	pending: PermissionRequest[]
	participants: string[]
	status: RoomStatus
	liveText: string
	loading: boolean
	error: string | null
	auth: AuthState | null
	authBusy: boolean
}

type Actions = {
	init: (pseudo: string) => Promise<void>
	setPseudo: (pseudo: string) => void
	refreshRooms: () => Promise<void>
	selectRoom: (roomId: string) => void
	createRoom: () => Promise<void>
	renameRoom: (roomId: string, title: string) => Promise<void>
	deleteRoom: (roomId: string) => Promise<void>
	sendMessage: (content: string, attachmentIds: string[]) => void
	approve: (requestId: string, allow: boolean) => void
	setModel: (model: string | null) => void
	dismissError: () => void
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
					status: s.room.status,
					liveText: s.liveTurn?.text ?? '',
					auth: s.auth,
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
			case 'file_change':
				if (message.action !== 'deleted') return
				set({ attachments: state.attachments.filter((a) => a.relPath !== message.relPath) })
				return
			case 'permission_request':
				set({ pending: [...state.pending, message.request] })
				return
			case 'permission_resolved':
				set({ pending: state.pending.filter((p) => p.requestId !== message.requestId) })
				return
			case 'status':
				set({ status: message.status })
				return
			case 'queued':
				set({ queue: [...state.queue, message.item] })
				return
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
			case 'auth':
				set({ auth: message.auth })
				return
			case 'error':
				set({ error: message.message })
				return
		}
	}

	const join = () => {
		const { activeRoomId, pseudo } = get()
		if (!activeRoomId || !socket) return
		socket.send({ type: 'join', roomId: activeRoomId, pseudo })
	}

	return {
		pseudo: '',
		connected: false,
		rooms: [],
		activeRoomId: null,
		loading: false,
		error: null,
		auth: null,
		authBusy: false,
		...empty,

		async init(pseudo) {
			set({ pseudo })
			localStorage.setItem('multiclaude:pseudo', pseudo)
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
			else await get().createRoom()
		},

		setPseudo(pseudo) {
			set({ pseudo })
			localStorage.setItem('multiclaude:pseudo', pseudo)
			join()
		},

		async refreshRooms() {
			set({ rooms: await api.rooms() })
		},

		selectRoom(roomId) {
			if (get().activeRoomId === roomId) return
			set({ activeRoomId: roomId, loading: true, ...empty })
			join()
		},

		async createRoom() {
			const room = await api.createRoom()
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

		async deleteRoom(roomId) {
			await api.deleteRoom(roomId)
			const rooms = get().rooms.filter((r) => r.id !== roomId)
			set({ rooms })
			if (get().activeRoomId !== roomId) return
			set({ activeRoomId: null, ...empty })
			const next = rooms[0]
			if (next) get().selectRoom(next.id)
			else await get().createRoom()
		},

		sendMessage(content, attachmentIds) {
			const { activeRoomId, pseudo } = get()
			if (!activeRoomId || !socket) return
			socket.send({ type: 'message', roomId: activeRoomId, pseudo, content, attachmentIds })
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

export const storedPseudo = () => localStorage.getItem('multiclaude:pseudo') ?? ''
