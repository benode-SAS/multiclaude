import type { ClientMessage, ServerMessage, Snapshot } from '@multiclaude/shared'
import { Elysia, t } from 'elysia'
import { getRuntime } from '../agent/runtime.ts'
import { AuthService } from '../auth/service.ts'
import { RoomService } from '../rooms/service.ts'
import { hub } from './hub.ts'

type Session = { roomId: string; pseudo: string }

const sessions = new Map<string, Session>()

function parse(raw: unknown): ClientMessage | null {
	const value = typeof raw === 'string' ? safeJson(raw) : raw
	if (!value || typeof value !== 'object' || !('type' in value)) return null
	return value as ClientMessage
}

function safeJson(raw: string): unknown {
	try {
		return JSON.parse(raw)
	} catch {
		return null
	}
}

export const wsRoutes = new Elysia().ws('/ws', {
	body: t.Unknown(),

	async message(ws, raw) {
		const send = (message: ServerMessage) => ws.send(message)
		const payload = parse(raw)
		if (!payload) return

		switch (payload.type) {
			case 'ping':
				return

			case 'join': {
				const previous = sessions.get(ws.id)
				if (previous) hub.leave(previous.roomId, ws.id)

				const room = await RoomService.get(payload.roomId)
				if (!room) return send({ type: 'error', message: 'room introuvable' })

				const pseudo = payload.pseudo.trim() || 'anonyme'
				sessions.set(ws.id, { roomId: room.id, pseudo })
				hub.join({ id: ws.id, roomId: room.id, pseudo, send })

				const runtime = await getRuntime(room.id)
				const state = runtime?.state() ?? { queue: [], pending: [], liveTurn: null }
				const snapshot: Snapshot = {
					room,
					messages: await RoomService.messages(room.id),
					events: await RoomService.events(room.id),
					attachments: await RoomService.attachments(room.id),
					queue: state.queue,
					pending: state.pending,
					participants: hub.participants(room.id),
					liveTurn: state.liveTurn,
					auth: await AuthService.status(),
				}
				return send({ type: 'snapshot', snapshot })
			}

			case 'message': {
				const session = sessions.get(ws.id)
				if (!session || session.roomId !== payload.roomId) return
				if (!payload.content.trim() && !payload.attachmentIds?.length) return
				const runtime = await getRuntime(payload.roomId)
				await runtime?.submit({
					pseudo: payload.pseudo.trim() || session.pseudo,
					content: payload.content.trim(),
					attachmentIds: payload.attachmentIds,
				})
				return
			}

			case 'approve': {
				const session = sessions.get(ws.id)
				if (!session || session.roomId !== payload.roomId) return
				const runtime = await getRuntime(payload.roomId)
				runtime?.approve(payload.requestId, payload.allow, session.pseudo)
				return
			}

			case 'rename': {
				const room = await RoomService.rename(payload.roomId, payload.title)
				if (room) hub.broadcast(room.id, { type: 'room_updated', room })
				return
			}

			case 'set_model': {
				const session = sessions.get(ws.id)
				if (!session || session.roomId !== payload.roomId) return
				const runtime = await getRuntime(payload.roomId)
				await runtime?.setModel(payload.model)
				return
			}
		}
	},

	close(ws) {
		const session = sessions.get(ws.id)
		if (!session) return
		sessions.delete(ws.id)
		hub.leave(session.roomId, ws.id)
	},
})
