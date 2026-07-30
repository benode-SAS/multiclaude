import type { PresenceInput } from '@multiclaude/shared'
import { useEffect, useRef } from 'react'

const THROTTLE_MS = 300

const sameSelection = (a: PresenceInput['selection'], b: PresenceInput['selection']) => {
	if (a === b) return true
	if (!a || !b) return false
	return a.scope === b.scope && a.key === b.key && a.start === b.start && a.end === b.end
}

const same = (a: PresenceInput, b: PresenceInput) =>
	a.view === b.view &&
	a.filePath === b.filePath &&
	sameSelection(a.selection, b.selection) &&
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

export const scrollRatio = (el: HTMLElement) => {
	const range = el.scrollHeight - el.clientHeight
	return range > 0 ? el.scrollTop / range : 0
}

export const applyScrollRatio = (el: HTMLElement, ratio: number) => {
	const range = el.scrollHeight - el.clientHeight
	if (range > 0) el.scrollTop = ratio * range
}
