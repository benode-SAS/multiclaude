import { MODELS, type Room, type RoomStatus } from '@multiclaude/shared'
import { useState } from 'react'
import { Avatar } from './Avatar.tsx'

export function RoomHeader({
	room,
	status,
	participants,
	filesOpen,
	onToggleFiles,
	onRename,
	onSetModel,
}: {
	room: Room
	status: RoomStatus
	participants: string[]
	filesOpen: boolean
	onToggleFiles: () => void
	onRename: (title: string) => void
	onSetModel: (model: string | null) => void
}) {
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(room.title)

	const commit = () => {
		if (draft.trim() && draft.trim() !== room.title) onRename(draft.trim())
		setEditing(false)
	}

	return (
		<header className="flex items-center gap-3 border-b border-line bg-canvas/80 px-6 py-3 backdrop-blur">
			{editing ? (
				<input
					autoFocus
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={commit}
					onKeyDown={(e) => {
						if (e.key === 'Enter') commit()
						if (e.key === 'Escape') setEditing(false)
					}}
					className="min-w-0 flex-1 rounded border border-accent/50 bg-surface px-2 py-1 text-[15px] font-semibold outline-none"
				/>
			) : (
				<button
					type="button"
					onDoubleClick={() => {
						setDraft(room.title)
						setEditing(true)
					}}
					className="min-w-0 truncate text-[15px] font-semibold"
					title="Double-clic pour renommer"
				>
					{room.title}
				</button>
			)}

			{status === 'running' && (
				<span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-accent">
					<span className="size-1.5 animate-pulse rounded-full bg-accent" />
					en cours
				</span>
			)}

			<label className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
				<span>Modèle</span>
				<select
					value={room.model ?? ''}
					onChange={(e) => onSetModel(e.target.value || null)}
					className="rounded-lg border border-line bg-surface px-2 py-1.5 text-[13px] text-ink outline-none transition hover:border-accent/50 focus:border-accent/60"
				>
					{MODELS.map((model) => (
						<option key={model.id ?? 'default'} value={model.id ?? ''}>
							{model.label}
						</option>
					))}
				</select>
			</label>

			<div className="flex items-center -space-x-2">
				{participants.map((participant) => (
					<div key={participant} className="rounded-full ring-2 ring-canvas">
						<Avatar author={participant} size={26} />
					</div>
				))}
			</div>

			<button
				type="button"
				onClick={onToggleFiles}
				className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] transition hover:border-accent/50"
			>
				{filesOpen ? 'Masquer' : 'Fichiers'}
			</button>
		</header>
	)
}
