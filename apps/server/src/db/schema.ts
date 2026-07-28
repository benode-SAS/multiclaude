import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const rooms = sqliteTable('rooms', {
	id: text('id').primaryKey(),
	title: text('title').notNull().default('Nouvelle conversation'),
	sessionId: text('session_id'),
	/** Alias passed to `claude --model`; null keeps the account default. */
	model: text('model'),
	workdir: text('workdir').notNull(),
	status: text('status', { enum: ['idle', 'running'] })
		.notNull()
		.default('idle'),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull(),
})

export const messages = sqliteTable(
	'messages',
	{
		id: text('id').primaryKey(),
		roomId: text('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' }),
		author: text('author').notNull(),
		role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
		content: text('content').notNull(),
		createdAt: integer('created_at').notNull(),
	},
	(t) => [index('messages_room_created_idx').on(t.roomId, t.createdAt)],
)

export const events = sqliteTable(
	'events',
	{
		id: text('id').primaryKey(),
		roomId: text('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' }),
		turnId: text('turn_id').notNull(),
		seq: integer('seq').notNull(),
		type: text('type', { enum: ['tool_use', 'tool_result', 'file_change', 'text'] }).notNull(),
		payload: text('payload', { mode: 'json' }).notNull(),
		createdAt: integer('created_at').notNull(),
	},
	(t) => [index('events_room_created_idx').on(t.roomId, t.createdAt)],
)

export const attachments = sqliteTable(
	'attachments',
	{
		id: text('id').primaryKey(),
		roomId: text('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' }),
		messageId: text('message_id'),
		source: text('source', { enum: ['user', 'claude'] }).notNull(),
		filename: text('filename').notNull(),
		relPath: text('rel_path').notNull(),
		mime: text('mime').notNull(),
		size: integer('size').notNull(),
		createdAt: integer('created_at').notNull(),
	},
	(t) => [index('attachments_room_path_idx').on(t.roomId, t.relPath)],
)
