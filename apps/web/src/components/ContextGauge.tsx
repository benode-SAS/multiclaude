import type { ContextUsage } from '@multiclaude/shared'
import clsx from 'clsx'

const compact = (tokens: number) =>
	tokens >= 1000 ? `${(tokens / 1000).toFixed(tokens >= 100_000 ? 0 : 1)}k` : String(tokens)

/**
 * Claude Code compacts on its own around 90 % of the window, so this is a
 * heads-up rather than a limit.
 */
export function ContextGauge({ usage }: { usage: ContextUsage }) {
	const ratio = usage.window > 0 ? Math.min(usage.tokens / usage.window, 1) : 0
	const percent = Math.round(ratio * 100)
	const level = ratio >= 0.9 ? 'danger' : ratio >= 0.7 ? 'warn' : 'ok'

	return (
		<div
			className="flex items-center gap-2 text-[12px] text-muted"
			title={`${usage.tokens.toLocaleString()} / ${usage.window.toLocaleString()} tokens · ${usage.model} · ${usage.costUsd.toFixed(2)} $`}
		>
			<span className="hidden sm:inline">context</span>
			<div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
				<div
					className={clsx(
						'h-full rounded-full transition-all',
						level === 'danger' ? 'bg-danger' : level === 'warn' ? 'bg-warn' : 'bg-accent',
					)}
					style={{ width: `${Math.max(percent, 2)}%` }}
				/>
			</div>
			<span
				className={clsx(
					'tabular-nums',
					level === 'danger' && 'text-danger',
					level === 'warn' && 'text-warn',
				)}
			>
				{percent}%
			</span>
			<span className="hidden text-muted md:inline">
				({compact(usage.tokens)}/{compact(usage.window)})
			</span>
		</div>
	)
}
