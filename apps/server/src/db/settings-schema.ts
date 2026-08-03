import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Admin overrides. A missing key means "keep whatever the `.env` says". */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: integer('updated_at').notNull(),
})
