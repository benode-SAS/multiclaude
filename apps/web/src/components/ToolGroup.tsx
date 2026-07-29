import { useState } from 'react'
import { describeTool, type ToolItem } from '../lib/timeline.ts'
import { ToolCard } from './ToolCard.tsx'

/** Icon + count per tool, in order of first appearance. */
function summarize(tools: ToolItem[]) {
	const counts = new Map<string, { icon: string; count: number }>()
	for (const tool of tools) {
		const { icon } = describeTool(tool.use)
		const entry = counts.get(tool.use.name)
		if (entry) entry.count++
		else counts.set(tool.use.name, { icon, count: 1 })
	}
	return [...counts.values()]
}

export function ToolGroup({ tools }: { tools: ToolItem[] }) {
	const [open, setOpen] = useState(false)

	const running = tools.some((tool) => tool.result === null)
	const failed = tools.filter((tool) => tool.result?.isError).length
	const current = tools.find((tool) => tool.result === null) ?? tools.at(-1)
	const label = current ? describeTool(current.use) : null

	if (open) {
		return (
			<div className="flex flex-col gap-2">
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="ml-[42px] flex items-center gap-2 self-start rounded-lg px-2 py-1 text-[12px] text-muted transition hover:bg-panel hover:text-ink"
				>
					<span>▴</span>
					{tools.length} actions
				</button>
				{tools.map((tool) => (
					<ToolCard key={tool.key} use={tool.use} result={tool.result} />
				))}
			</div>
		)
	}

	return (
		<div className="ml-[42px] max-w-[min(760px,100%)]">
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface/70 px-3 py-2 text-left text-[13px] transition hover:bg-panel/60"
			>
				<span className="flex items-center gap-1.5">
					{summarize(tools).map((entry) => (
						<span key={entry.icon} className="flex items-center gap-0.5">
							<span>{entry.icon}</span>
							<span className="text-muted">{entry.count}</span>
						</span>
					))}
				</span>

				<span className="text-muted">·</span>
				<span className="text-muted">{tools.length} actions</span>

				{/* Keep the live step visible so a long run still reads as progress. */}
				{running && label && (
					<code className="min-w-0 flex-1 truncate rounded bg-panel px-1.5 py-0.5 font-mono text-[12px] text-ink">
						{label.target ?? label.label}
					</code>
				)}
				{running && <span className="shrink-0 animate-pulse text-accent">…</span>}
				{!running && failed > 0 && <span className="shrink-0 text-danger">{failed} en erreur</span>}

				<span className="ml-auto shrink-0 text-muted">▾</span>
			</button>
		</div>
	)
}
