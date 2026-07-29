import type { PermissionRequest } from '@multiclaude/shared'

const summarize = (request: PermissionRequest) => {
	const command = request.input.command
	if (typeof command === 'string') return command
	return JSON.stringify(request.input, null, 2)
}

export function PermissionCard({
	request,
	onDecide,
}: {
	request: PermissionRequest
	onDecide: (allow: boolean) => void
}) {
	return (
		<div className="ml-[42px] max-w-[min(760px,100%)] rounded-xl border border-accent/40 bg-accent-soft/50 p-3">
			<div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-accent">
				<span>🔒</span>
				<span>Claude demande à exécuter {request.tool}</span>
				{request.reason && (
					<span className="rounded-full border border-accent/30 px-2 py-0.5 text-[11px] font-normal">
						{request.reason}
					</span>
				)}
			</div>
			<pre className="mb-3 max-h-48 overflow-auto rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[12px] whitespace-pre-wrap">
				{summarize(request)}
			</pre>
			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => onDecide(true)}
					className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition hover:brightness-95"
				>
					Autoriser
				</button>
				<button
					type="button"
					onClick={() => onDecide(false)}
					className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium transition hover:bg-panel"
				>
					Refuser
				</button>
			</div>
		</div>
	)
}
