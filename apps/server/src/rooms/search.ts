import { and, desc, eq, or, sql } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import { db } from '../db/index.ts'
import { messages, rooms } from '../db/schema.ts'

export type SearchHit = {
	roomId: string
	roomTitle: string
	messageId: string
	author: string
	excerpt: string
	createdAt: number
}

const EXCERPT = 160

/** Construit depuis un code de caractère : les échappements d'antislash dans un
 * gabarit SQL se perdent trop facilement en route. */
const ESCAPE_CHAR = String.fromCharCode(92)

/** Extrait centré sur la première occurrence, pour montrer le contexte utile. */
function excerptAround(content: string, needle: string) {
	const at = content.toLowerCase().indexOf(needle.toLowerCase())
	if (at === -1) return content.slice(0, EXCERPT)
	const start = Math.max(0, at - EXCERPT / 3)
	const text = content.slice(start, start + EXCERPT)
	return (start > 0 ? '…' : '') + text + (start + EXCERPT < content.length ? '…' : '')
}

export async function searchMessages(query: string, roomId?: string): Promise<SearchHit[]> {
	const term = query.trim()
	if (term.length < 2) return []

	// %, _ and \ are SQL wildcards. Escaping them is not enough: without an
	// ESCAPE clause, SQLite reads the backslash as an ordinary character.
	const escaped = term.replace(/[\\%_]/g, (character) => `${ESCAPE_CHAR}${character}`)
	const pattern = `%${escaped}%`
	const matches = (column: SQLiteColumn) => sql`${column} LIKE ${pattern} ESCAPE ${ESCAPE_CHAR}`

	const rows = await db
		.select({
			roomId: messages.roomId,
			roomTitle: rooms.title,
			messageId: messages.id,
			author: messages.author,
			content: messages.content,
			createdAt: messages.createdAt,
		})
		.from(messages)
		.innerJoin(rooms, eq(rooms.id, messages.roomId))
		.where(
			roomId
				? and(eq(messages.roomId, roomId), matches(messages.content))
				: or(matches(messages.content), matches(rooms.title)),
		)
		.orderBy(desc(messages.createdAt))
		.limit(50)

	return rows.map((row) => ({
		roomId: row.roomId,
		roomTitle: row.roomTitle,
		messageId: row.messageId,
		author: row.author,
		excerpt: excerptAround(row.content, term),
		createdAt: row.createdAt,
	}))
}
