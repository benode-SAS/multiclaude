import type { ClientMessage, ServerMessage, Snapshot } from '@multiclaude/shared'
import { Elysia, t } from 'elysia'
import { currentUser } from '../accounts/guard.ts'
import { getRuntime } from '../agent/runtime.ts'
import { AuthService } from '../auth/service.ts'
import { DraftService } from '../rooms/drafts.ts'
import { RoomService } from '../rooms/service.ts'
import { hub } from './hub.ts'
import { presence } from './presence.ts'
import { typing } from './typing.ts'

type Session = { roomId: string; pseudo: string; userId: string; role: 'admin' | 'member' }

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
				// Identity comes from the session, never from the client: a free-form
				// pseudo would let anyone pass for someone else.
				const account = await currentUser(ws.data.request)
				if (!account) return send({ type: 'error', message: 'connexion requise' })

				const previous = sessions.get(ws.id)
				if (previous) {
					typing.clear(previous.roomId, previous.pseudo)
					hub.leave(previous.roomId, ws.id)
					presence.leave(previous.roomId, previous.pseudo)
				}

				const room = await RoomService.get(payload.roomId)
				if (!room) return send({ type: 'error', message: 'room introuvable' })

				const pseudo = account.name
				sessions.set(ws.id, { roomId: room.id, pseudo, userId: account.id, role: account.role })
				hub.join({ id: ws.id, roomId: room.id, pseudo, send })

				const runtime = await getRuntime(room.id)
				const state = runtime?.state() ?? {
					queue: [],
					pending: [],
					liveTurn: null,
					usage: null,
				}
				const snapshot: Snapshot = {
					room,
					messages: await RoomService.messages(room.id),
					events: await RoomService.events(room.id),
					attachments: await RoomService.attachments(room.id),
					queue: state.queue,
					pending: state.pending,
					participants: hub.participants(room.id),
					typing: typing.list(room.id).filter((p) => p !== pseudo),
					drafts: await DraftService.list(room.id),
					presence: presence.list(room.id),
					liveTurn: state.liveTurn,
					auth: await AuthService.status(),
					usage: state.usage,
				}
				return send({ type: 'snapshot', snapshot })
			}

			case 'message': {
				const session = sessions.get(ws.id)
				if (!session || session.roomId !== payload.roomId) return
				if (!payload.content.trim() && !payload.attachmentIds?.length) return
				typing.clear(session.roomId, session.pseudo)
				await DraftService.clear(session.roomId, session.pseudo)
				hub.broadcast(
					session.roomId,
					{ type: 'draft', draft: { pseudo: session.pseudo, content: '', updatedAt: Date.now() } },
					ws.id,
				)
				const runtime = await getRuntime(payload.roomId)
				await runtime?.submit({
					pseudo: session.pseudo,
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
				const session = sessions.get(ws.id)
				// A rename affects everyone, so admins only.
				if (session?.role !== 'admin') return
				const room = await RoomService.rename(payload.roomId, payload.title)
				if (room) hub.broadcast(room.id, { type: 'room_updated', room })
				return
			}

			case 'stop': {
				const session = sessions.get(ws.id)
				if (!session || session.roomId !== payload.roomId) return
				const runtime = await getRuntime(payload.roomId)
				await runtime?.stop(session.pseudo)
				return
			}

			case 'edit_message': {
				const session = sessions.get(ws.id)
				if (!session || session.roomId !== payload.roomId) return
				const content = payload.content.trim()
				if (!content) return

				const existing = await RoomService.message(payload.messageId)
				// Only your own messages, and never Claude's.
				if (!existing || existing.roomId !== session.roomId) return
				if (existing.role !== 'user' || existing.author !== session.pseudo) return

				const updated = await RoomService.editMessage(payload.messageId, content)
				if (!updated) return

				const runtime = await getRuntime(session.roomId)
				// Still queued: the corrected version is the one that will be sent.
				if (runtime?.editQueued(payload.messageId, content)) {
					hub.broadcast(session.roomId, {
						type: 'queued',
						item: { id: updated.id, pseudo: updated.author, content },
					})
				}
				hub.broadcast(session.roomId, { type: 'message_updated', message: updated })
				return
			}

			case 'cancel_queued': {
				const session = sessions.get(ws.id)
				if (!session || session.roomId !== payload.roomId) return
				const runtime = await getRuntime(session.roomId)
				if (!runtime?.cancelQueued(payload.messageId)) return
				await RoomService.removeMessage(payload.messageId)
				hub.broadcast(session.roomId, { type: 'dequeued', id: payload.messageId })
				hub.broadcast(session.roomId, { type: 'message_removed', messageId: payload.messageId })
				return
			}

			case 'draft': {
				const session = sessions.get(ws.id)
				if (!session || session.roomId !== payload.roomId) return
				const draft = await DraftService.save(session.roomId, session.pseudo, payload.content)
				// Broadcast to the others: the author already has the text on screen.
				hub.broadcast(session.roomId, { type: 'draft', draft }, ws.id)
				return
			}

			case 'presence': {
				const session = sessions.get(ws.id)
				if (!session || session.roomId !== payload.roomId) return
				presence.set(session.roomId, session.pseudo, payload.presence, ws.id)
				return
			}

			case 'typing': {
				const session = sessions.get(ws.id)
				if (!session || session.roomId !== payload.roomId) return
				typing.set(session.roomId, session.pseudo, payload.typing, ws.id)
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
		typing.clear(session.roomId, session.pseudo)
		hub.leave(session.roomId, ws.id)
		presence.leave(session.roomId, session.pseudo)
	},
})
