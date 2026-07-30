import type { Presence, PresenceInput } from '@multiclaude/shared'
import { hub } from './hub.ts'

/**
 * Purely in-memory: presence describes where someone is right now, so it has no
 * meaning once they are gone and nothing to restore after a restart.
 */
const rooms = new Map<string, Map<string, Presence>>()

const EXCERPT = 400

export const presence = {
	set(roomId: string, pseudo: string, input: PresenceInput, exceptConnId?: string) {
		let room = rooms.get(roomId)
		if (!room) {
			room = new Map()
			rooms.set(roomId, room)
		}

		const next: Presence = {
			pseudo,
			view: input.view === 'file' ? 'file' : 'chat',
			filePath: input.filePath ?? null,
			scroll: Number.isFinite(input.scroll) ? Math.min(Math.max(input.scroll, 0), 1) : 0,
			selection: input.selection
				? { ...input.selection, text: input.selection.text.slice(0, EXCERPT) }
				: null,
			updatedAt: Date.now(),
		}
		room.set(pseudo, next)
		hub.broadcast(roomId, { type: 'presence', presence: next }, exceptConnId)
	},

	list(roomId: string) {
		return [...(rooms.get(roomId)?.values() ?? [])]
	},

	/** Only drops the entry once the pseudo has no connection left in the room. */
	leave(roomId: string, pseudo: string) {
		if (hub.participants(roomId).includes(pseudo)) return
		const room = rooms.get(roomId)
		if (!room?.delete(pseudo)) return
		if (room.size === 0) rooms.delete(roomId)
		hub.broadcast(roomId, { type: 'presence_left', pseudo })
	},
}
