import type { ServerMessage } from '@multiclaude/shared'

export type Connection = {
	id: string
	roomId: string
	pseudo: string
	send: (message: ServerMessage) => void
}

const byRoom = new Map<string, Map<string, Connection>>()

export const hub = {
	join(conn: Connection) {
		let room = byRoom.get(conn.roomId)
		if (!room) {
			room = new Map()
			byRoom.set(conn.roomId, room)
		}
		room.set(conn.id, conn)
		hub.broadcastParticipants(conn.roomId)
	},

	leave(roomId: string, connId: string) {
		const room = byRoom.get(roomId)
		if (!room) return
		room.delete(connId)
		if (room.size === 0) byRoom.delete(roomId)
		else hub.broadcastParticipants(roomId)
	},

	participants(roomId: string) {
		return [...new Set([...(byRoom.get(roomId)?.values() ?? [])].map((c) => c.pseudo))]
	},

	broadcast(roomId: string, message: ServerMessage, exceptConnId?: string) {
		for (const conn of byRoom.get(roomId)?.values() ?? []) {
			if (conn.id === exceptConnId) continue
			try {
				conn.send(message)
			} catch {
				// dead socket, dropped on close
			}
		}
	},

	broadcastAll(message: ServerMessage) {
		for (const room of byRoom.values()) {
			for (const conn of room.values()) {
				try {
					conn.send(message)
				} catch {
					// dead socket, dropped on close
				}
			}
		}
	},

	broadcastParticipants(roomId: string) {
		hub.broadcast(roomId, { type: 'participants', participants: hub.participants(roomId) })
	},
}
