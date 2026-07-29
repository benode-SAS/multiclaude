import type { ToolResultPayload, ToolUsePayload } from '@multiclaude/shared'
import clsx from 'clsx'
import { useState } from 'react'
import { describeTool, toolDetail } from '../lib/timeline.ts'

export function ToolCard({
	use,
	result,
}: {
	use: ToolUsePayload
	result: ToolResultPayload | null
}) {
	const [open, setOpen] = useState(false)
	const { icon, label, target } = describeTool(use)
	const detail = toolDetail(use)
	const running = result === null

	return (
		<div className="ml-0 md:ml-[42px] max-w-[min(760px,100%)]">
			<div
				className={clsx(
					'overflow-hidden rounded-xl border bg-surface/70 text-[13px]',
					result?.isError ? 'border-danger/40' : 'border-line',
				)}
			>
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-panel/60"
				>
					<span>{icon}</span>
					<span className="text-muted">{label}</span>
					{target && (
						<code className="min-w-0 flex-1 truncate rounded bg-panel px-1.5 py-0.5 font-mono text-[12px] text-ink">
							{target}
						</code>
					)}
					{running && <span className="text-muted">…</span>}
					{result?.isError && <span className="text-danger">erreur</span>}
					<span className="ml-auto text-muted">{open ? '▴' : '▾'}</span>
				</button>

				{open && (
					<div className="border-t border-line">
						{detail && (
							<pre className="max-h-72 overflow-auto bg-panel/50 px-3 py-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
								{detail}
							</pre>
						)}
						{result && (
							<pre
								className={clsx(
									'max-h-72 overflow-auto border-t border-line px-3 py-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap',
									result.isError ? 'text-danger' : 'text-muted',
								)}
							>
								{result.content || '(vide)'}
							</pre>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
