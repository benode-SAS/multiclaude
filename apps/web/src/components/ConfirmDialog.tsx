import { useEffect, useRef } from 'react'

/**
 * Rendered from App rather than from the component that triggers it: inside the
 * mobile drawer, the sliding transform would become the containing block and a
 * `fixed` overlay would be clipped to the drawer.
 */
export function ConfirmDialog({
	title,
	message,
	detail,
	confirmLabel = 'Confirmer',
	onConfirm,
	onCancel,
}: {
	title: string
	message: string
	detail?: string
	confirmLabel?: string
	onConfirm: () => void
	onCancel: () => void
}) {
	const cancelRef = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		// Focus lands on the harmless choice, not the destructive one.
		cancelRef.current?.focus()
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onCancel()
			if (event.key === 'Enter') onConfirm()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onCancel, onConfirm])

	return (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
			<button
				type="button"
				aria-label="Annuler"
				onClick={onCancel}
				className="absolute inset-0 cursor-default"
			/>
			<div
				role="alertdialog"
				aria-modal="true"
				aria-label={title}
				className="relative w-full max-w-sm rounded-2xl border border-line bg-canvas p-5 shadow-2xl"
			>
				<h2 className="text-[15px] font-semibold">{title}</h2>
				<p className="mt-2 text-[13px] text-muted">{message}</p>
				{detail && (
					<p className="mt-2 truncate rounded-lg bg-panel px-2.5 py-1.5 font-mono text-[12px]">
						{detail}
					</p>
				)}

				<div className="mt-5 flex justify-end gap-2">
					<button
						ref={cancelRef}
						type="button"
						onClick={onCancel}
						className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] transition hover:bg-panel"
					>
						Annuler
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-medium text-white transition hover:brightness-110"
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	)
}
