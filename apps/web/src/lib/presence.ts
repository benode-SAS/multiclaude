import type { PresenceInput } from '@multiclaude/shared'
import { useEffect, useRef } from 'react'

const THROTTLE_MS = 300
const SELECTION_MAX = 400

const same = (a: PresenceInput, b: PresenceInput) =>
	a.view === b.view &&
	a.filePath === b.filePath &&
	a.selection === b.selection &&
	a.selectionMessageId === b.selectionMessageId &&
	Math.abs(a.scroll - b.scroll) < 0.005

/**
 * Reports where the user is, throttled and deduplicated: scrolling fires
 * constantly, and an unchanged position is not worth a frame on the wire.
 */
export function usePresenceReporter(state: PresenceInput, send: (p: PresenceInput) => void) {
	const last = useRef<PresenceInput | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pending = useRef<PresenceInput | null>(null)
	const sendRef = useRef(send)
	sendRef.current = send

	useEffect(() => {
		pending.current = state
		if (timer.current) return

		timer.current = setTimeout(() => {
			timer.current = null
			const next = pending.current
			if (!next) return
			if (last.current && same(last.current, next)) return
			last.current = next
			sendRef.current(next)
		}, THROTTLE_MS)
	}, [state])

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current)
		},
		[],
	)
}

/** Current selection, plus the message it belongs to when there is one. */
export function readSelection() {
	const selection = window.getSelection()
	const text = selection?.toString().trim() ?? ''
	if (!text) return { selection: null, selectionMessageId: null }

	let node = selection?.anchorNode as HTMLElement | null
	if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement
	const holder = node?.closest?.('[data-message-id]') ?? null

	return {
		selection: text.slice(0, SELECTION_MAX),
		selectionMessageId: holder?.getAttribute('data-message-id') ?? null,
	}
}

export const scrollRatio = (el: HTMLElement) => {
	const range = el.scrollHeight - el.clientHeight
	return range > 0 ? el.scrollTop / range : 0
}

export const applyScrollRatio = (el: HTMLElement, ratio: number) => {
	const range = el.scrollHeight - el.clientHeight
	if (range > 0) el.scrollTop = ratio * range
}
