import { hub } from './hub.ts'

/**
 * Typing state is ephemeral and never persisted. Each signal refreshes this
 * expiry, set well above the client heartbeat: it only catches dead tabs, it
 * does not arbitrate a pause in the typing.
 */
const EXPIRY_MS = 15_000

const rooms = new Map<string, Map<string, ReturnType<typeof setTimeout>>>()

function stop(roomId: string, pseudo: string, notify: boolean) {
	const room = rooms.get(roomId)
	const timer = room?.get(pseudo)
	if (!timer) return
	clearTimeout(timer)
	room?.delete(pseudo)
	if (room?.size === 0) rooms.delete(roomId)
	if (notify) hub.broadcast(roomId, { type: 'typing', pseudo, typing: false })
}

export const typing = {
	set(roomId: string, pseudo: string, isTyping: boolean, exceptConnId?: string) {
		if (!isTyping) {
			stop(roomId, pseudo, true)
			return
		}

		let room = rooms.get(roomId)
		if (!room) {
			room = new Map()
			rooms.set(roomId, room)
		}

		const known = room.has(pseudo)
		clearTimeout(room.get(pseudo))
		room.set(
			pseudo,
			setTimeout(() => stop(roomId, pseudo, true), EXPIRY_MS),
		)
		if (!known) {
			hub.broadcast(roomId, { type: 'typing', pseudo, typing: true }, exceptConnId)
		}
	},

	list(roomId: string) {
		return [...(rooms.get(roomId)?.keys() ?? [])]
	},

	clear(roomId: string, pseudo: string) {
		stop(roomId, pseudo, true)
	},
}
