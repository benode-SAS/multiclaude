import type { Room, SelectionAnchor } from '@multiclaude/shared'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { AuthPanel } from './components/AuthPanel.tsx'
import { Composer } from './components/Composer.tsx'
import { ConfirmDialog } from './components/ConfirmDialog.tsx'
import { FilesPanel } from './components/FilesPanel.tsx'
import { FileViewer, type ViewerTarget } from './components/FileViewer.tsx'
import { FollowBar } from './components/FollowBar.tsx'
import { NewRoomDialog } from './components/NewRoomDialog.tsx'
import { PseudoGate } from './components/PseudoGate.tsx'
import { ResizeHandle } from './components/ResizeHandle.tsx'
import { RoomHeader } from './components/RoomHeader.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Thread } from './components/Thread.tsx'
import { useDockWidth, useIsDesktop } from './lib/layout.ts'
import { usePresenceReporter } from './lib/presence.ts'
import { describeSelection, paintSelections, previewHighlights } from './lib/selection.ts'
import { applyTheme, storedTheme, watchSystemTheme } from './lib/theme.ts'
import { storedPseudo, useStore } from './store.ts'

export function App() {
	const store = useStore()
	const [gate, setGate] = useState(!storedPseudo())
	const [filesOpen, setFilesOpen] = useState(false)
	const [viewing, setViewing] = useState<ViewerTarget | null>(null)
	const [navOpen, setNavOpen] = useState(false)
	const [pendingDelete, setPendingDelete] = useState<Room | null>(null)
	const [creating, setCreating] = useState(false)
	const [createBusy, setCreateBusy] = useState(false)
	const [createError, setCreateError] = useState<string | null>(null)
	const [chatScroll, setChatScroll] = useState(0)
	const [fileScroll, setFileScroll] = useState(0)
	const [selection, setSelection] = useState<SelectionAnchor | null>(null)

	const isDesktop = useIsDesktop()
	const [dockWidth, setDockWidth, resetDockWidth] = useDockWidth()

	useEffect(() => {
		const pseudo = storedPseudo()
		if (pseudo && !store.pseudo) void store.init(pseudo)
	}, [store])

	// 'system' must follow the OS while the app stays open.
	useEffect(() => watchSystemTheme(() => applyTheme(storedTheme())), [])

	useEffect(() => {
		const onSelectionChange = () => setSelection(describeSelection())
		document.addEventListener('selectionchange', onSelectionChange)
		return () => document.removeEventListener('selectionchange', onSelectionChange)
	}, [])

	// Les sélections des autres sont peintes en permanence, pas seulement en
	// mode suivi : c'est ce qui rend la présence lisible à la Google Docs.
	useEffect(() => {
		paintSelections(Object.values(store.presence))
	}, [store.presence, store.messages, viewing])

	const followed = store.following ? store.presence[store.following] : undefined

	// Mirror the followed person's file, so opening one on their side opens it here.
	useEffect(() => {
		if (!followed) return
		if (followed.view === 'file' && followed.filePath) {
			setViewing((current) =>
				current?.relPath === followed.filePath
					? current
					: { relPath: followed.filePath!, filename: followed.filePath!, mime: '', size: 0 },
			)
		} else {
			setViewing(null)
		}
	}, [followed])

	usePresenceReporter(
		{
			view: viewing ? 'file' : 'chat',
			filePath: viewing?.relPath ?? null,
			scroll: viewing ? fileScroll : chatScroll,
			selection,
		},
		store.reportPresence,
	)

	if (gate || !store.pseudo) {
		return (
			<PseudoGate
				initial={storedPseudo()}
				onSubmit={(pseudo) => {
					setGate(false)
					if (store.pseudo) store.setPseudo(pseudo)
					else void store.init(pseudo)
				}}
			/>
		)
	}

	// One dock on the right, and the viewer takes precedence over the file list:
	// three side panels would leave the conversation unreadably narrow.
	const dock = store.room ? (viewing ? 'viewer' : filesOpen ? 'files' : null) : null

	const dockContent =
		dock === 'viewer' && viewing && store.room ? (
			<FileViewer
				target={viewing}
				roomId={store.room.id}
				onClose={() => {
					setViewing(null)
					if (store.following) store.follow(null)
				}}
				onScrollRatio={setFileScroll}
				followScroll={followed && followed.view === 'file' ? followed.scroll : null}
				onSelection={setSelection}
				highlights={previewHighlights(Object.values(store.presence), viewing.relPath)}
				version={store.fileVersions[viewing.relPath] ?? 0}
			/>
		) : dock === 'files' && store.room ? (
			<FilesPanel
				roomId={store.room.id}
				revision={store.filesRevision}
				onOpen={setViewing}
				onClose={() => setFilesOpen(false)}
			/>
		) : null

	return (
		<div className="relative flex h-dvh overflow-hidden">
			{/* Colonne fixe à partir de md, tiroir coulissant en dessous. */}
			<div
				className={clsx(
					'z-[60] transition-transform duration-200 md:static md:z-auto md:translate-x-0',
					'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:shadow-2xl',
					navOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
				)}
			>
				<Sidebar
					rooms={store.rooms}
					activeRoomId={store.activeRoomId}
					pseudo={store.pseudo}
					connected={store.connected}
					onSelect={store.selectRoom}
					onCreate={() => {
						setCreateError(null)
						setCreating(true)
					}}
					onRename={(id, title) => void store.renameRoom(id, title)}
					onDelete={(id) => setPendingDelete(store.rooms.find((room) => room.id === id) ?? null)}
					onChangePseudo={() => setGate(true)}
					theme={store.theme}
					onSetTheme={store.setTheme}
					sound={store.sound}
					onToggleSound={store.toggleSound}
					notify={store.notify}
					onToggleNotify={() => void store.toggleNotify()}
					authEmail={store.auth?.email ?? null}
					onRelogin={() => void store.startLogin()}
					onNavigate={() => setNavOpen(false)}
				/>
			</div>

			{navOpen && (
				<button
					type="button"
					aria-label="Fermer le menu"
					onClick={() => setNavOpen(false)}
					className="fixed inset-0 z-[55] bg-black/40 md:hidden"
				/>
			)}

			<main className="flex min-w-0 flex-1 flex-col">
				{store.room ? (
					<>
						<RoomHeader
							room={store.room}
							status={store.status}
							participants={store.participants}
							filesOpen={dock === 'files'}
							onToggleFiles={() => {
								setViewing(null)
								setFilesOpen((open) => !open)
							}}
							onRename={(title) => void store.renameRoom(store.room!.id, title)}
							onSetModel={store.setModel}
							onStop={store.stopTurn}
							usage={store.usage}
							onOpenNav={() => setNavOpen(true)}
							self={store.pseudo}
							following={store.following}
							onFollow={store.follow}
						/>

						{store.following && (
							<FollowBar
								pseudo={store.following}
								presence={followed}
								onStop={() => store.follow(null)}
							/>
						)}

						{store.auth && (
							<AuthPanel
								auth={store.auth}
								busy={store.authBusy}
								onStart={() => void store.startLogin()}
								onSubmitCode={(code) => void store.submitCode(code)}
								onCancel={() => void store.cancelLogin()}
							/>
						)}

						{store.error && (
							<div className="flex items-center gap-2 border-b border-danger/30 bg-danger-soft px-4 py-2 text-[13px] text-danger md:px-6">
								<span className="flex-1">{store.error}</span>
								<button type="button" onClick={store.dismissError} className="underline">
									fermer
								</button>
							</div>
						)}

						<Thread
							roomId={store.room.id}
							messages={store.messages}
							events={store.events}
							attachments={store.attachments}
							queue={store.queue}
							pending={store.pending}
							liveText={store.liveText}
							running={store.status === 'running'}
							onApprove={store.approve}
							onOpen={setViewing}
							self={store.pseudo}
							onEditMessage={store.editMessage}
							onScrollRatio={setChatScroll}
							followScroll={followed && followed.view === 'chat' ? followed.scroll : null}
						/>

						<Composer
							roomId={store.room.id}
							status={store.status}
							typing={store.typing}
							drafts={store.drafts}
							draft={store.draft}
							queue={store.queue}
							self={store.pseudo}
							onEditQueued={store.editMessage}
							onCancelQueued={store.cancelQueued}
							onSend={store.sendMessage}
							onTyping={store.setTyping}
							onDraft={store.saveDraft}
						/>
					</>
				) : (
					<div className="flex flex-1 items-center justify-center text-[14px] text-muted">
						{store.loading ? 'Chargement…' : 'Sélectionne une conversation'}
					</div>
				)}
			</main>

			{/* Panneau redimensionnable sur desktop, plein écran sur mobile. */}
			{dockContent &&
				(isDesktop ? (
					<>
						<ResizeHandle width={dockWidth} onWidth={setDockWidth} onReset={resetDockWidth} />
						<aside style={{ width: dockWidth }} className="min-w-0 shrink-0 border-l border-line">
							{dockContent}
						</aside>
					</>
				) : (
					<div className="fixed inset-0 z-50 bg-canvas">{dockContent}</div>
				))}

			{creating && (
				<NewRoomDialog
					busy={createBusy}
					error={createError}
					onCancel={() => setCreating(false)}
					onCreate={async (input) => {
						setCreateBusy(true)
						setCreateError(null)
						try {
							await store.createRoom(input)
							setCreating(false)
							setNavOpen(false)
						} catch (error) {
							// Le serveur renvoie la raison exacte de l'échec du clone.
							const detail = error instanceof Error ? error.message : String(error)
							setCreateError(detail.replace(/^\d+\s*/, ''))
						} finally {
							setCreateBusy(false)
						}
					}}
				/>
			)}

			{pendingDelete && (
				<ConfirmDialog
					title="Supprimer la conversation ?"
					message="L'historique et le dossier de travail de cette room sont effacés définitivement."
					detail={pendingDelete.title}
					confirmLabel="Supprimer"
					onCancel={() => setPendingDelete(null)}
					onConfirm={() => {
						void store.deleteRoom(pendingDelete.id)
						setPendingDelete(null)
						setNavOpen(false)
					}}
				/>
			)}
		</div>
	)
}
