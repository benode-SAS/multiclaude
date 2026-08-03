import type { AgentEvent, Message, ToolUsePayload } from '@multiclaude/shared'
import { RoomService } from './service.ts'

const stamp = (ms: number) =>
	new Date(ms).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

const describeTool = (payload: ToolUsePayload) => {
	const input = payload.input
	const detail =
		typeof input.command === 'string'
			? input.command
			: typeof input.file_path === 'string'
				? input.file_path
				: typeof input.pattern === 'string'
					? input.pattern
					: ''
	return detail ? `${payload.name} — \`${detail}\`` : payload.name
}

/**
 * Renders the conversation as markdown readable outside the app: messages and
 * actions in order. Tool results stay out — they are bulky and only useful on
 * screen.
 */
export async function exportRoom(roomId: string) {
	const room = await RoomService.get(roomId)
	if (!room) return null

	const [messages, events] = await Promise.all([
		RoomService.messages(roomId),
		RoomService.events(roomId),
	])

	type Entry = { at: number; text: string }
	const entries: Entry[] = messages.map((message: Message) => ({
		at: message.createdAt,
		text:
			message.role === 'system'
				? `> _${message.content}_`
				: `**${message.author === 'claude' ? 'Claude' : message.author}** · ${stamp(message.createdAt)}\n\n${message.content}`,
	}))

	for (const event of events as AgentEvent[]) {
		if (event.type !== 'tool_use') continue
		entries.push({
			at: event.createdAt,
			text: `<sub>⚙ ${describeTool(event.payload as ToolUsePayload)}</sub>`,
		})
	}

	entries.sort((a, b) => a.at - b.at)

	const header = [
		`# ${room.title}`,
		'',
		`Exportée le ${stamp(Date.now())} · ${messages.length} messages`,
		room.model ? `Modèle : ${room.model}` : null,
		'',
		'---',
		'',
	]
		.filter((line) => line !== null)
		.join('\n')

	return { room, markdown: header + entries.map((entry) => entry.text).join('\n\n') }
}
