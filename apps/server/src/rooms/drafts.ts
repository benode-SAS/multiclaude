import type { Draft } from '@multiclaude/shared'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { drafts } from '../db/schema.ts'
import { now } from '../lib/ids.ts'

const MAX_LENGTH = 20_000

export const DraftService = {
	async list(roomId: string): Promise<Draft[]> {
		const rows = await db.select().from(drafts).where(eq(drafts.roomId, roomId))
		return rows.map((row) => ({
			pseudo: row.pseudo,
			content: row.content,
			updatedAt: row.updatedAt,
		}))
	},

	/** Empty content clears the row rather than storing a blank draft. */
	async save(roomId: string, pseudo: string, content: string): Promise<Draft> {
		const trimmed = content.slice(0, MAX_LENGTH)
		const updatedAt = now()

		if (!trimmed) {
			await DraftService.clear(roomId, pseudo)
			return { pseudo, content: '', updatedAt }
		}

		await db
			.insert(drafts)
			.values({ roomId, pseudo, content: trimmed, updatedAt })
			.onConflictDoUpdate({
				target: [drafts.roomId, drafts.pseudo],
				set: { content: trimmed, updatedAt },
			})

		return { pseudo, content: trimmed, updatedAt }
	},

	async clear(roomId: string, pseudo: string) {
		await db.delete(drafts).where(and(eq(drafts.roomId, roomId), eq(drafts.pseudo, pseudo)))
	},
}
