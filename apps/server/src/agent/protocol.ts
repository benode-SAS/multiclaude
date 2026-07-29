/** Subset of the `claude --output-format stream-json` wire format we consume. */

export type ContentBlock =
	| { type: 'text'; text: string }
	| { type: 'thinking'; thinking?: string }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
	| { type: 'tool_result'; tool_use_id: string; is_error?: boolean; content: unknown }
	| { type: string; [key: string]: unknown }

export type CliMessage =
	| { type: 'system'; subtype: string; session_id?: string; [key: string]: unknown }
	| {
			type: 'stream_event'
			event: {
				type: string
				delta?: { type: string; text?: string }
				[key: string]: unknown
			}
	  }
	| { type: 'assistant'; message: { content: ContentBlock[] }; session_id?: string }
	| { type: 'user'; message: { content: ContentBlock[] | string }; session_id?: string }
	| {
			type: 'result'
			subtype: string
			is_error?: boolean
			result?: string
			session_id?: string
			total_cost_usd?: number
			/** Tokens of the *last* request — i.e. the live context size. */
			usage?: {
				input_tokens?: number
				cache_creation_input_tokens?: number
				cache_read_input_tokens?: number
				output_tokens?: number
			}
			/** Per-model totals; the source of truth for each model's window. */
			modelUsage?: Record<string, { contextWindow?: number }>
	  }

export type UserInput = {
	type: 'user'
	message: { role: 'user'; content: Array<{ type: 'text'; text: string }> }
}
