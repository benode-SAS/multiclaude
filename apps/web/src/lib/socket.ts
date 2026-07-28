import type { ClientMessage, ServerMessage } from '@multiclaude/shared'

type Handlers = {
	onMessage: (message: ServerMessage) => void
	onStatusChange: (connected: boolean) => void
}

export function createSocket({ onMessage, onStatusChange }: Handlers) {
	let ws: WebSocket | null = null
	let retry = 0
	let closed = false
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null
	let onReady: (() => void) | null = null
	const outbox: ClientMessage[] = []

	const open = () => {
		const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
		ws = new WebSocket(url)

		ws.onopen = () => {
			retry = 0
			onStatusChange(true)
			onReady?.()
			while (outbox.length) ws?.send(JSON.stringify(outbox.shift()))
		}

		ws.onmessage = (event) => {
			try {
				onMessage(JSON.parse(event.data) as ServerMessage)
			} catch {
				// ignore malformed frame
			}
		}

		ws.onclose = () => {
			onStatusChange(false)
			if (closed) return
			retry = Math.min(retry + 1, 6)
			reconnectTimer = setTimeout(open, 250 * 2 ** (retry - 1))
		}

		ws.onerror = () => ws?.close()
	}

	open()

	return {
		send(message: ClientMessage) {
			if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
			else outbox.push(message)
		},
		set onOpen(fn: (() => void) | null) {
			onReady = fn
		},
		close() {
			closed = true
			if (reconnectTimer) clearTimeout(reconnectTimer)
			ws?.close()
		},
	}
}

export type Socket = ReturnType<typeof createSocket>
