import type { AccountSummary } from '@multiclaude/shared'
import { asc, count, eq } from 'drizzle-orm'
import { user } from '../db/auth-schema.ts'
import { db } from '../db/index.ts'

const toSummary = (row: typeof user.$inferSelect): AccountSummary => ({
	id: row.id,
	name: row.name,
	email: row.email,
	role: row.role,
	createdAt: row.createdAt.getTime(),
})

export const AccountService = {
	async count() {
		const [row] = await db.select({ total: count() }).from(user)
		return row?.total ?? 0
	},

	async list(): Promise<AccountSummary[]> {
		const rows = await db.select().from(user).orderBy(asc(user.createdAt))
		return rows.map(toSummary)
	},

	async get(id: string): Promise<AccountSummary | null> {
		const [row] = await db.select().from(user).where(eq(user.id, id)).limit(1)
		return row ? toSummary(row) : null
	},

	async setRole(id: string, role: 'admin' | 'member') {
		await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, id))
		return AccountService.get(id)
	},

	async remove(id: string) {
		await db.delete(user).where(eq(user.id, id))
	},

	/** The very first account administers, otherwise nobody can set anything up. */
	async promoteIfFirst(id: string) {
		if ((await AccountService.count()) !== 1) return
		await db.update(user).set({ role: 'admin' }).where(eq(user.id, id))
	},

	async adminCount() {
		const [row] = await db.select({ total: count() }).from(user).where(eq(user.role, 'admin'))
		return row?.total ?? 0
	},
}
