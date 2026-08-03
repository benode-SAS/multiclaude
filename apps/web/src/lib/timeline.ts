import type {
	AgentEvent,
	Attachment,
	Message,
	ToolResultPayload,
	ToolUsePayload,
} from '@multiclaude/shared'
import type { IconName } from '../components/Icon.tsx'

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

export type ToolItem = Extract<TimelineItem, { kind: 'tool' }>

export type TimelineRow =
	| Exclude<TimelineItem, { kind: 'tool' }>
	| ToolItem
	| { kind: 'tools'; key: string; at: number; tools: ToolItem[] }

/**
 * Folds runs of back-to-back tool calls into one collapsible row. A lone call
 * stays as it is — grouping a single action would only add a click.
 */
export function groupTimeline(items: TimelineItem[]): TimelineRow[] {
	const rows: TimelineRow[] = []
	let run: ToolItem[] = []

	const flush = () => {
		if (run.length === 0) return
		if (run.length === 1) rows.push(run[0]!)
		else rows.push({ kind: 'tools', key: `g-${run[0]!.key}`, at: run[0]!.at, tools: run })
		run = []
	}

	for (const item of items) {
		if (item.kind === 'tool') {
			run.push(item)
			continue
		}
		flush()
		rows.push(item)
	}
	flush()
	return rows
}

const str = (value: unknown) => (typeof value === 'string' ? value : undefined)

export function describeTool(use: ToolUsePayload): {
	icon: IconName
	label: string
	target?: string
} {
	const input = use.input
	const file = str(input.file_path) ?? str(input.path) ?? str(input.notebook_path)
	switch (use.name) {
		case 'Write':
			return { icon: 'file', label: 'wrote', target: file }
		case 'Edit':
		case 'NotebookEdit':
			return { icon: 'pencil', label: 'edited', target: file }
		case 'Read':
			return { icon: 'book', label: 'read', target: file }
		case 'Bash':
			return { icon: 'terminal', label: 'ran', target: str(input.command) }
		case 'Glob':
			return { icon: 'search', label: 'looked for', target: str(input.pattern) }
		case 'Grep':
			return { icon: 'search', label: 'grepped', target: str(input.pattern) }
		case 'WebSearch':
			return { icon: 'globe', label: 'searched the web for', target: str(input.query) }
		case 'WebFetch':
			return { icon: 'globe', label: 'fetched', target: str(input.url) }
		case 'TodoWrite':
			return { icon: 'list', label: 'updated its todo list', target: undefined }
		case 'Task':
			return { icon: 'sparkles', label: 'delegated', target: str(input.description) }
		default:
			return { icon: 'wrench', label: `used ${use.name}`, target: file }
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
