import { useRef } from 'react'
import { DOCK_MIN } from '../lib/layout.ts'

const STEP = 24
const BIG_STEP = 96

/**
 * Splitter between the chat and the right dock. Pointer capture keeps the drag
 * alive when the cursor outruns the 6 px handle; arrow keys do the same job
 * without a pointer.
 */
export function ResizeHandle({
	width,
	onWidth,
	onReset,
}: {
	width: number
	onWidth: (width: number) => void
	onReset: () => void
}) {
	const dragging = useRef(false)

	const clamp = (value: number) => Math.min(Math.max(value, DOCK_MIN), window.innerWidth * 0.75)

	return (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize the panel"
			aria-valuenow={Math.round(width)}
			aria-valuemin={DOCK_MIN}
			aria-valuemax={Math.round(window.innerWidth * 0.75)}
			tabIndex={0}
			title="Drag to resize · double-click to reset"
			onPointerDown={(event) => {
				dragging.current = true
				event.currentTarget.setPointerCapture(event.pointerId)
				document.body.style.userSelect = 'none'
			}}
			onPointerMove={(event) => {
				if (dragging.current) onWidth(clamp(window.innerWidth - event.clientX))
			}}
			onPointerUp={(event) => {
				dragging.current = false
				event.currentTarget.releasePointerCapture(event.pointerId)
				document.body.style.userSelect = ''
			}}
			onDoubleClick={onReset}
			onKeyDown={(event) => {
				const step = event.shiftKey ? BIG_STEP : STEP
				// The dock sits on the right, so a left arrow widens it.
				if (event.key === 'ArrowLeft') onWidth(clamp(width + step))
				else if (event.key === 'ArrowRight') onWidth(clamp(width - step))
				else if (event.key === 'Home' || event.key === 'Enter') onReset()
				else return
				event.preventDefault()
			}}
			className="relative w-1.5 shrink-0 cursor-col-resize touch-none bg-line transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none active:bg-accent"
		>
			{/* Widen the grab area without widening the visible line. */}
			<span className="absolute inset-y-0 -left-1.5 -right-1.5" />
		</div>
	)
}
