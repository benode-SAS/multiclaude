import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const rooms = sqliteTable('rooms', {
	id: text('id').primaryKey(),
	title: text('title').notNull().default('Nouvelle conversation'),
	sessionId: text('session_id'),
	/** Alias passed to `claude --model`; null keeps the account default. */
	model: text('model'),
	/** Room this one was forked from, shown in the list. */
	forkedFrom: text('forked_from'),
	/**
	 * The next spawn must branch off the parent session instead of resuming it,
	 * or both rooms would write into the same one.
	 */
	forkPending: integer('fork_pending', { mode: 'boolean' }).notNull().default(false),
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
		/** Set when the message was corrected, so the thread stays honest. */
		editedAt: integer('edited_at'),
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

/**
 * Unsent message per participant. Persisted rather than kept in memory so a
 * draft survives a server restart, and reaches the same pseudo on any device.
 */
export const drafts = sqliteTable(
	'drafts',
	{
		roomId: text('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' }),
		pseudo: text('pseudo').notNull(),
		content: text('content').notNull(),
		updatedAt: integer('updated_at').notNull(),
	},
	(t) => [primaryKey({ columns: [t.roomId, t.pseudo] })],
)
