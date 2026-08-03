import type { Presence } from '@multiclaude/shared'
import { Avatar } from './Avatar.tsx'

/** What the followed person is doing, in one line. */
function describe(presence: Presence) {
	if (presence.view === 'file' && presence.filePath) return `regarde ${presence.filePath}`
	return 'est dans la conversation'
}

export function FollowBar({
	pseudo,
	presence,
	onStop,
}: {
	pseudo: string
	presence: Presence | undefined
	onStop: () => void
}) {
	return (
		<div className="flex items-center gap-2 border-b border-accent/40 bg-accent-soft px-4 py-2 text-[13px] md:px-6">
			<Avatar author={pseudo} size={20} />
			<span className="font-medium text-accent-ink">Tu suis {pseudo}</span>
			<span className="hidden text-muted sm:inline">
				— {presence ? describe(presence) : 'position inconnue'}
			</span>

			{presence?.selection && (
				<span
					className="ml-2 hidden min-w-0 max-w-xs truncate rounded bg-surface px-2 py-0.5 font-mono text-[11px] md:inline"
					title={presence.selection.text}
				>
					« {presence.selection.text} »
				</span>
			)}

			<button
				type="button"
				onClick={onStop}
				className="ml-auto shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1 text-[12px] transition hover:bg-panel"
			>
				Arrêter
			</button>
		</div>
	)
}
