import type { Room } from '@multiclaude/shared'
import clsx from 'clsx'
import { useState } from 'react'
import { formatDay } from '../lib/format.ts'
import type { Theme } from '../lib/theme.ts'
import { Avatar } from './Avatar.tsx'
import { SearchBox } from './SearchBox.tsx'

const THEMES: Array<{ id: Theme; icon: string; label: string }> = [
	{ id: 'light', icon: '☀', label: 'Clair' },
	{ id: 'dark', icon: '☾', label: 'Sombre' },
	{ id: 'system', icon: '◐', label: 'Système' },
]

export function Sidebar({
	rooms,
	activeRoomId,
	pseudo,
	connected,
	onSelect,
	onCreate,
	onRename,
	onDelete,
	onSignOut,
	role,
	email,
	theme,
	onSetTheme,
	sound,
	onToggleSound,
	notify,
	onToggleNotify,
	authEmail,
	onRelogin,
	onNavigate,
	onOpenAdmin,
}: {
	rooms: Room[]
	activeRoomId: string | null
	pseudo: string
	connected: boolean
	theme: Theme
	onSetTheme: (theme: Theme) => void
	sound: boolean
	onToggleSound: () => void
	notify: boolean
	onToggleNotify: () => void
	authEmail: string | null
	onRelogin: () => void
	/** Called after any action that should dismiss the mobile drawer. */
	onNavigate: () => void
	onSelect: (id: string) => void
	onCreate: () => void
	onRename: (id: string, title: string) => void
	onDelete: (id: string) => void
	onSignOut: () => void
	onOpenAdmin: () => void
	role: 'admin' | 'member'
	email: string
}) {
	const [editingId, setEditingId] = useState<string | null>(null)
	const [draft, setDraft] = useState('')

	const commit = (id: string) => {
		if (draft.trim()) onRename(id, draft.trim())
		setEditingId(null)
	}

	return (
		<aside className="rail flex h-full w-[260px] shrink-0 flex-col border-r border-line bg-panel text-ink">
			<div className="px-3 py-4">
				<div className="mb-3 flex items-center gap-2 px-1">
					<span className="text-[15px] font-semibold tracking-tight">
						multi<span className="text-accent">claude</span>
					</span>
					<span
						className={clsx('ml-auto size-2 rounded-full', connected ? 'bg-ok' : 'bg-warn')}
						title={connected ? 'connecté' : 'reconnexion…'}
					/>
				</div>
				<button
					type="button"
					onClick={onCreate}
					className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-left text-[14px] font-medium transition hover:border-accent/50"
				>
					<span className="mr-2 text-accent">+</span>
					Nouvelle conversation
				</button>
			</div>

			<SearchBox
				onOpen={(id) => {
					onSelect(id)
					onNavigate()
				}}
			/>

			<nav className="flex-1 overflow-y-auto px-2 pb-2">
				{rooms.map((room) => (
					<div
						key={room.id}
						className={clsx(
							'group mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[14px] transition',
							room.id === activeRoomId ? 'bg-surface shadow-sm' : 'hover:bg-surface/60',
						)}
					>
						{editingId === room.id && role === 'admin' ? (
							<input
								autoFocus
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onBlur={() => commit(room.id)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') commit(room.id)
									if (e.key === 'Escape') setEditingId(null)
								}}
								className="min-w-0 flex-1 rounded border border-accent/50 bg-canvas px-1.5 py-0.5 outline-none"
							/>
						) : (
							<button
								type="button"
								onClick={() => {
									onSelect(room.id)
									onNavigate()
								}}
								onDoubleClick={() => {
									if (role !== 'admin') return
									setEditingId(room.id)
									setDraft(room.title)
								}}
								className="min-w-0 flex-1 truncate text-left"
								title={room.forkedFrom ? `${room.title} — issue d'un fork` : room.title}
							>
								{room.forkedFrom && <span className="mr-1 text-muted">⑂</span>}
								{room.title}
							</button>
						)}

						{room.status === 'running' && (
							<span className="size-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
						)}

						{/* No hover on mobile, so the actions stay visible there. */}
						<span className="shrink-0 text-[11px] text-muted max-md:hidden group-hover:hidden">
							{formatDay(room.updatedAt)}
						</span>
						{/* Rename and delete affect everyone: admins only, and the server
						    refuses on its side too. */}
						{role === 'admin' && (
							<span className="shrink-0 items-center gap-1 max-md:flex hidden group-hover:flex">
								<button
									type="button"
									onClick={() => {
										setEditingId(room.id)
										setDraft(room.title)
									}}
									className="text-[12px] text-muted hover:text-ink"
									title="Renommer"
								>
									✎
								</button>
								<button
									type="button"
									onClick={() => onDelete(room.id)}
									className="text-[12px] text-muted hover:text-danger"
									title="Supprimer"
								>
									🗑
								</button>
							</span>
						)}
					</div>
				))}
			</nav>

			<div className="flex items-center gap-2 border-t border-line px-3 py-2">
				<div className="flex overflow-hidden rounded-lg border border-line">
					{THEMES.map((option) => (
						<button
							key={option.id}
							type="button"
							onClick={() => onSetTheme(option.id)}
							title={option.label}
							className={clsx(
								'px-2 py-1 text-[13px] transition',
								theme === option.id
									? 'bg-accent text-on-accent'
									: 'bg-surface text-muted hover:text-ink',
							)}
						>
							{option.icon}
						</button>
					))}
				</div>

				{/* Always reachable: re-logging in must not depend on a failure being
				    detected first. */}
				<button
					type="button"
					onClick={onRelogin}
					title={
						authEmail ? `Compte Claude : ${authEmail} — reconnecter` : 'Connecter un compte Claude'
					}
					className="rounded-lg border border-line bg-surface px-2 py-1 text-[13px] text-muted transition hover:text-ink"
				>
					🔑
				</button>

				<button
					type="button"
					onClick={onToggleSound}
					title={sound ? 'Son des demandes : activé' : 'Son des demandes : coupé'}
					className={clsx(
						'rounded-lg border border-line px-2 py-1 text-[13px] transition',
						sound ? 'bg-surface text-ink' : 'bg-surface text-muted line-through',
					)}
				>
					{sound ? '🔔' : '🔕'}
				</button>

				{/* The chime is useless with the tab closed, hence system notifications. */}
				<button
					type="button"
					onClick={onToggleNotify}
					title={
						notify
							? 'Notifications système : activées'
							: 'Notifications système : désactivées — une demande non vue expire'
					}
					className={clsx(
						'rounded-lg border border-line px-2 py-1 text-[13px] transition',
						notify ? 'bg-surface text-ink' : 'bg-surface text-muted line-through',
					)}
				>
					🖥
				</button>
			</div>

			<div className="flex items-center gap-2 border-t border-line px-3 py-3 text-[13px]">
				<Avatar author={pseudo} size={26} />
				<span className="min-w-0 flex-1">
					<span className="block truncate font-medium">{pseudo}</span>
					<span className="block truncate text-[11px] text-muted">
						{role === 'admin' ? 'administrateur' : email}
					</span>
				</span>
				{role === 'admin' && (
					<button
						type="button"
						onClick={() => {
							onOpenAdmin()
							onNavigate()
						}}
						title="Administration — comptes et configuration"
						className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-muted transition hover:text-ink"
					>
						⚙
					</button>
				)}
				<button
					type="button"
					onClick={onSignOut}
					title="Se déconnecter"
					className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-muted transition hover:text-ink"
				>
					⏻
				</button>
			</div>
		</aside>
	)
}
