import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import type {
	AgentEvent,
	Attachment,
	Message,
	MessageRole,
	Room,
	RoomStatus,
} from '@multiclaude/shared'
import { and, asc, eq } from 'drizzle-orm'
import { SettingsService } from '../accounts/settings.ts'
import { copySessionTo } from '../agent/sessions.ts'
import { config } from '../config.ts'
import { db } from '../db/index.ts'
import { attachments, events, messages, rooms } from '../db/schema.ts'
import { newId, now } from '../lib/ids.ts'

type RoomRow = typeof rooms.$inferSelect

const toRoom = (r: RoomRow): Room => ({
	id: r.id,
	title: r.title,
	sessionId: r.sessionId,
	model: r.model,
	forkedFrom: r.forkedFrom,
	workdir: r.workdir,
	status: r.status,
	createdAt: r.createdAt,
	updatedAt: r.updatedAt,
})

export const RoomService = {
	async list(): Promise<Room[]> {
		const rows = await db.select().from(rooms).orderBy(asc(rooms.updatedAt))
		return rows.map(toRoom).reverse()
	},

	async get(id: string): Promise<Room | null> {
		const [row] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1)
		return row ? toRoom(row) : null
	},

	async create(title?: string): Promise<Room> {
		const id = newId()
		const workdir = path.join(config.roomsDir, id, 'workdir')
		// Left empty: git clone refuses a non-empty directory. uploads/ is created
		// on the first upload.
		await mkdir(workdir, { recursive: true })
		const ts = now()
		const row = {
			id,
			title: title?.trim() || 'New conversation',
			sessionId: null,
			model: SettingsService.defaultModel(),
			forkedFrom: null,
			forkPending: false,
			workdir,
			status: 'idle' as const,
			createdAt: ts,
			updatedAt: ts,
		}
		await db.insert(rooms).values(row)
		return toRoom(row)
	},

	async rename(id: string, title: string): Promise<Room | null> {
		await db
			.update(rooms)
			.set({ title: title.trim() || 'New conversation', updatedAt: now() })
			.where(eq(rooms.id, id))
		return RoomService.get(id)
	},

	async setStatus(id: string, status: RoomStatus) {
		await db.update(rooms).set({ status, updatedAt: now() }).where(eq(rooms.id, id))
	},

	async setSessionId(id: string, sessionId: string) {
		await db.update(rooms).set({ sessionId, updatedAt: now() }).where(eq(rooms.id, id))
	},

	async setModel(id: string, model: string | null): Promise<Room | null> {
		await db.update(rooms).set({ model, updatedAt: now() }).where(eq(rooms.id, id))
		return RoomService.get(id)
	},

	/**
	 * Duplicates the room: same files, and the parent session is branched off on
	 * the next spawn so both threads move on without colliding.
	 */
	async fork(sourceId: string, title?: string): Promise<Room | null> {
		const source = await RoomService.get(sourceId)
		if (!source) return null

		const id = newId()
		const workdir = path.join(config.roomsDir, id, 'workdir')
		await mkdir(path.dirname(workdir), { recursive: true })
		await cp(source.workdir, workdir, { recursive: true })

		// The transcript has to follow: --resume only looks in the current
		// project, so without it the fork starts without the inherited context.
		const inherited = source.sessionId
			? await copySessionTo(source.workdir, workdir, source.sessionId)
			: false

		const ts = now()
		const row = {
			id,
			title: title?.trim() || `${source.title} (fork)`,
			sessionId: inherited ? source.sessionId : null,
			model: source.model,
			forkedFrom: source.id,
			forkPending: inherited,
			workdir,
			status: 'idle' as const,
			createdAt: ts,
			updatedAt: ts,
		}
		await db.insert(rooms).values(row)

		// The visible history is copied too, so the fork reads as a thread from
		// the moment it opens.
		const history = await RoomService.messages(sourceId)
		for (const message of history) {
			await db.insert(messages).values({ ...message, id: newId(), roomId: id })
		}

		return toRoom(row)
	},

	async isForkPending(id: string) {
		const [row] = await db
			.select({ forkPending: rooms.forkPending })
			.from(rooms)
			.where(eq(rooms.id, id))
			.limit(1)
		return row?.forkPending ?? false
	},

	async clearForkPending(id: string) {
		await db.update(rooms).set({ forkPending: false }).where(eq(rooms.id, id))
	},

	async remove(id: string) {
		const room = await RoomService.get(id)
		if (!room) return false
		await db.delete(rooms).where(eq(rooms.id, id))
		await rm(path.join(config.roomsDir, id), { recursive: true, force: true })
		return true
	},

	async resetStuckRooms() {
		await db.update(rooms).set({ status: 'idle' }).where(eq(rooms.status, 'running'))
	},

	async messages(roomId: string): Promise<Message[]> {
		return db
			.select()
			.from(messages)
			.where(eq(messages.roomId, roomId))
			.orderBy(asc(messages.createdAt))
	},

	async addMessage(input: {
		roomId: string
		author: string
		role: MessageRole
		content: string
	}): Promise<Message> {
		const message: Message = { id: newId(), createdAt: now(), ...input }
		await db.insert(messages).values(message)
		await db.update(rooms).set({ updatedAt: message.createdAt }).where(eq(rooms.id, input.roomId))
		return message
	},

	async message(id: string): Promise<Message | null> {
		const [row] = await db.select().from(messages).where(eq(messages.id, id)).limit(1)
		return row ?? null
	},

	async editMessage(id: string, content: string): Promise<Message | null> {
		const editedAt = now()
		await db.update(messages).set({ content, editedAt }).where(eq(messages.id, id))
		return RoomService.message(id)
	},

	async removeMessage(id: string) {
		await db.delete(messages).where(eq(messages.id, id))
	},

	async events(roomId: string): Promise<AgentEvent[]> {
		const rows = await db
			.select()
			.from(events)
			.where(eq(events.roomId, roomId))
			.orderBy(asc(events.createdAt), asc(events.seq))
		return rows as AgentEvent[]
	},

	async addEvent(input: Omit<AgentEvent, 'id' | 'createdAt'>): Promise<AgentEvent> {
		const event: AgentEvent = { id: newId(), createdAt: now(), ...input }
		await db.insert(events).values(event)
		return event
	},

	async attachments(roomId: string): Promise<Attachment[]> {
		return db
			.select()
			.from(attachments)
			.where(eq(attachments.roomId, roomId))
			.orderBy(asc(attachments.createdAt))
	},

	async attachmentByPath(roomId: string, relPath: string): Promise<Attachment | null> {
		const [row] = await db
			.select()
			.from(attachments)
			.where(and(eq(attachments.roomId, roomId), eq(attachments.relPath, relPath)))
			.limit(1)
		return row ?? null
	},

	async upsertAttachment(input: Omit<Attachment, 'id' | 'createdAt'>): Promise<Attachment> {
		const existing = await RoomService.attachmentByPath(input.roomId, input.relPath)
		if (existing) {
			const next = { ...existing, size: input.size, mime: input.mime }
			await db
				.update(attachments)
				.set({ size: input.size, mime: input.mime })
				.where(eq(attachments.id, existing.id))
			return next
		}
		const attachment: Attachment = { id: newId(), createdAt: now(), ...input }
		await db.insert(attachments).values(attachment)
		return attachment
	},

	async removeAttachmentByPath(roomId: string, relPath: string) {
		await db
			.delete(attachments)
			.where(and(eq(attachments.roomId, roomId), eq(attachments.relPath, relPath)))
	},

	async attachmentsByIds(roomId: string, ids: string[]): Promise<Attachment[]> {
		if (!ids.length) return []
		const all = await RoomService.attachments(roomId)
		return all.filter((a) => ids.includes(a.id))
	},

	async linkAttachments(ids: string[], messageId: string) {
		for (const id of ids) {
			await db.update(attachments).set({ messageId }).where(eq(attachments.id, id))
		}
	},
}
