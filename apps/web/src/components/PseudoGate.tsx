import { useState } from 'react'

export function PseudoGate({
	initial,
	onSubmit,
}: {
	initial: string
	onSubmit: (pseudo: string) => void
}) {
	const [value, setValue] = useState(initial)

	return (
		<div className="flex h-dvh items-center justify-center bg-canvas p-4">
			<form
				onSubmit={(e) => {
					e.preventDefault()
					if (value.trim()) onSubmit(value.trim())
				}}
				className="w-full max-w-[340px] rounded-2xl border border-line bg-surface p-6 shadow-sm"
			>
				<h1 className="text-lg font-semibold tracking-tight">multiclaude</h1>
				<p className="mt-1 mb-5 text-[13px] text-muted">
					Choisis un pseudo — il identifie tes messages dans la conversation.
				</p>
				<input
					autoFocus
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder="Benjamin"
					maxLength={24}
					className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[15px] outline-none focus:border-accent/60"
				/>
				<button
					type="submit"
					disabled={!value.trim()}
					className="mt-3 w-full rounded-xl bg-accent py-2.5 text-[14px] font-medium text-white transition enabled:hover:brightness-95 disabled:opacity-40"
				>
					Entrer
				</button>
			</form>
		</div>
	)
}
