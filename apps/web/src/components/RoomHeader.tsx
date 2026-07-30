import { type ContextUsage, MODELS, type Room, type RoomStatus } from '@multiclaude/shared'
import clsx from 'clsx'
import { useState } from 'react'
import { Avatar } from './Avatar.tsx'
import { ContextGauge } from './ContextGauge.tsx'

export function RoomHeader({
	room,
	status,
	participants,
	filesOpen,
	onToggleFiles,
	onRename,
	onSetModel,
	onStop,
	usage,
	onOpenNav,
	self,
	following,
	onFollow,
}: {
	room: Room
	status: RoomStatus
	participants: string[]
	filesOpen: boolean
	onToggleFiles: () => void
	onRename: (title: string) => void
	onSetModel: (model: string | null) => void
	onStop: () => void
	usage: ContextUsage | null
	onOpenNav: () => void
	self: string
	following: string | null
	onFollow: (pseudo: string | null) => void
}) {
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(room.title)

	const commit = () => {
		if (draft.trim() && draft.trim() !== room.title) onRename(draft.trim())
		setEditing(false)
	}

	const startEditing = () => {
		setDraft(room.title)
		setEditing(true)
	}

	return (
		<header className="flex min-w-0 items-center gap-2 overflow-hidden border-b border-line bg-canvas/80 px-3 py-2.5 backdrop-blur md:gap-3 md:px-6 md:py-3">
			{/* Ouvre le tiroir : la sidebar est masquée sous md. */}
			<button
				type="button"
				onClick={onOpenNav}
				title="Conversations"
				className="-ml-1 shrink-0 rounded-lg px-2 py-1.5 text-[15px] text-muted transition hover:bg-panel hover:text-ink md:hidden"
			>
				☰
			</button>

			{editing ? (
				<input
					autoFocus
					value={draft}
					// Selected on focus: renaming usually means replacing, not appending.
					onFocus={(e) => e.currentTarget.select()}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={commit}
					onKeyDown={(e) => {
						if (e.key === 'Enter') commit()
						if (e.key === 'Escape') setEditing(false)
					}}
					className="min-w-0 flex-1 rounded border border-accent/50 bg-surface px-2 py-1 text-[15px] font-semibold outline-none"
				/>
			) : (
				// The pencil carries the affordance: double-click alone was invisible,
				// and unusable on touch.
				<div className="group flex min-w-0 flex-1 items-center gap-1">
					<button
						type="button"
						onDoubleClick={startEditing}
						className="min-w-0 truncate text-[15px] font-semibold"
						title="Double-clic pour renommer"
					>
						{room.title}
					</button>
					<button
						type="button"
						onClick={startEditing}
						title="Renommer la conversation"
						className="shrink-0 rounded px-1 py-0.5 text-[12px] text-muted opacity-100 transition hover:bg-panel hover:text-ink md:opacity-0 md:group-hover:opacity-100"
					>
						✎
					</button>
				</div>
			)}

			{status === 'running' && (
				<div className="flex items-center gap-1.5">
					<span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-accent">
						<span className="size-1.5 animate-pulse rounded-full bg-accent" />
						<span className="hidden sm:inline">en cours</span>
					</span>
					<button
						type="button"
						onClick={onStop}
						title="Interrompre le turn en cours"
						className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] transition hover:border-danger/50 hover:text-danger"
					>
						<span className="text-[9px]">■</span>
						<span className="hidden sm:inline">Stopper</span>
					</button>
				</div>
			)}

			{usage && (
				<div className="hidden shrink-0 lg:block">
					<ContextGauge usage={usage} />
				</div>
			)}

			{/* Borné en largeur : « Défaut du compte » suffit à faire déborder un iPhone. */}
			<label className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted">
				<span className="hidden lg:inline">Modèle</span>
				<select
					value={room.model ?? ''}
					onChange={(e) => onSetModel(e.target.value || null)}
					className="max-w-[6.5rem] truncate rounded-lg border border-line bg-surface px-2 py-1.5 text-[13px] text-ink outline-none transition hover:border-accent/50 focus:border-accent/60 md:max-w-none"
				>
					{MODELS.map((model) => (
						<option key={model.id ?? 'default'} value={model.id ?? ''}>
							{model.label}
						</option>
					))}
				</select>
			</label>

			{/* Cliquer un badge met la vue en miroir de la sienne. */}
			<div className="hidden shrink-0 items-center -space-x-2 lg:flex">
				{participants.map((participant) => (
					<button
						key={participant}
						type="button"
						disabled={participant === self}
						onClick={() => onFollow(participant === following ? null : participant)}
						title={
							participant === self
								? participant
								: participant === following
									? `Arrêter de suivre ${participant}`
									: `Suivre ${participant}`
						}
						className={clsx(
							'rounded-full ring-2 transition',
							participant === following ? 'ring-accent' : 'ring-canvas',
							participant !== self && 'hover:ring-accent/60',
						)}
					>
						<Avatar author={participant} size={26} />
					</button>
				))}
			</div>

			<button
				type="button"
				onClick={onToggleFiles}
				className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] transition hover:border-accent/50"
			>
				<span className="hidden md:inline">{filesOpen ? 'Masquer' : 'Fichiers'}</span>
				<span className="md:hidden">📁</span>
			</button>
		</header>
	)
}
