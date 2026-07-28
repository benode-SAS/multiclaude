import type {
	AgentEvent,
	Attachment,
	Message,
	ToolResultPayload,
	ToolUsePayload,
} from '@multiclaude/shared'

export type TimelineItem =
	| { kind: 'message'; key: string; at: number; message: Message }
	| {
			kind: 'tool'
			key: string
			at: number
			use: ToolUsePayload
			result: ToolResultPayload | null
	  }
	| { kind: 'file'; key: string; at: number; attachment: Attachment }

export function buildTimeline(
	messages: Message[],
	events: AgentEvent[],
	attachments: Attachment[],
): TimelineItem[] {
	const results = new Map<string, ToolResultPayload>()
	for (const event of events) {
		if (event.type !== 'tool_result') continue
		const payload = event.payload as ToolResultPayload
		results.set(payload.toolUseId, payload)
	}

	const items: TimelineItem[] = messages.map((message) => ({
		kind: 'message',
		key: message.id,
		at: message.createdAt,
		message,
	}))

	for (const event of events) {
		if (event.type !== 'tool_use') continue
		const use = event.payload as ToolUsePayload
		items.push({
			kind: 'tool',
			key: event.id,
			at: event.createdAt,
			use,
			result: results.get(use.toolUseId) ?? null,
		})
	}

	for (const attachment of attachments) {
		if (attachment.source !== 'claude') continue
		items.push({ kind: 'file', key: attachment.id, at: attachment.createdAt, attachment })
	}

	return items.sort((a, b) => a.at - b.at)
}

const str = (value: unknown) => (typeof value === 'string' ? value : undefined)

export function describeTool(use: ToolUsePayload) {
	const input = use.input
	const file = str(input.file_path) ?? str(input.path) ?? str(input.notebook_path)
	switch (use.name) {
		case 'Write':
			return { icon: '📝', label: 'a écrit', target: file }
		case 'Edit':
		case 'NotebookEdit':
			return { icon: '✏️', label: 'a modifié', target: file }
		case 'Read':
			return { icon: '📖', label: 'a lu', target: file }
		case 'Bash':
			return { icon: '⚡', label: 'a exécuté', target: str(input.command) }
		case 'Glob':
			return { icon: '🔍', label: 'a cherché', target: str(input.pattern) }
		case 'Grep':
			return { icon: '🔍', label: 'a grepé', target: str(input.pattern) }
		case 'WebSearch':
			return { icon: '🌐', label: 'a recherché', target: str(input.query) }
		case 'WebFetch':
			return { icon: '🌐', label: 'a consulté', target: str(input.url) }
		case 'TodoWrite':
			return { icon: '📋', label: 'a mis à jour sa todo', target: undefined }
		case 'Task':
			return { icon: '🤖', label: 'a délégué', target: str(input.description) }
		default:
			return { icon: '🔧', label: `a utilisé ${use.name}`, target: file }
	}
}

export function toolDetail(use: ToolUsePayload) {
	const input = use.input
	if (use.name === 'Write') return str(input.content) ?? ''
	if (use.name === 'Edit') {
		const before = str(input.old_string) ?? ''
		const after = str(input.new_string) ?? ''
		return `${before
			.split('\n')
			.map((l) => `- ${l}`)
			.join('\n')}\n${after
			.split('\n')
			.map((l) => `+ ${l}`)
			.join('\n')}`
	}
	return JSON.stringify(input, null, 2)
}
