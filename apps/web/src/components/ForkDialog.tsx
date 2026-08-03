import { useEffect, useState } from 'react'

/**
 * A fork copies the workdir and inherits the context, so it is not free —
 * enough to be worth a confirmation rather than firing on a single click.
 */
export function ForkDialog({
	sourceTitle,
	busy,
	onFork,
	onCancel,
}: {
	sourceTitle: string
	busy: boolean
	onFork: (title: string) => void
	onCancel: () => void
}) {
	const [title, setTitle] = useState(`${sourceTitle} (fork)`)

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !busy) onCancel()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onCancel, busy])

	return (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
			<button
				type="button"
				aria-label="Cancel"
				onClick={() => !busy && onCancel()}
				className="absolute inset-0 cursor-default"
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault()
					if (!busy) onFork(title.trim())
				}}
				className="relative w-full max-w-md rounded-2xl border border-line bg-canvas p-5 shadow-2xl"
			>
				<h2 className="text-[15px] font-semibold">Fork the conversation</h2>
				<p className="mt-2 text-[13px] text-muted">
					Files are copied and the context is inherited: the two threads then move on separately,
					without disturbing each other. The original conversation is untouched.
				</p>

				<label className="mt-4 block text-[12px] text-muted" htmlFor="fork-title">
					Fork title
					<input
						id="fork-title"
						autoFocus
						value={title}
						onFocus={(e) => e.currentTarget.select()}
						onChange={(e) => setTitle(e.target.value)}
						disabled={busy}
						className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-accent/60 disabled:opacity-50"
					/>
				</label>

				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						disabled={busy}
						className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] transition hover:bg-panel disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={busy}
						className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-on-accent transition enabled:hover:brightness-95 disabled:opacity-60"
					>
						{busy ? 'Copying…' : 'Fork'}
					</button>
				</div>
			</form>
		</div>
	)
}
