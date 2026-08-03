import type { Room, SelectionAnchor } from '@multiclaude/shared'
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { AdminPanel } from './components/AdminPanel.tsx'
import { AuthGate } from './components/AuthGate.tsx'
import { AuthPanel } from './components/AuthPanel.tsx'
import { Composer } from './components/Composer.tsx'
import { ConfirmDialog } from './components/ConfirmDialog.tsx'
import { FilesPanel } from './components/FilesPanel.tsx'
import { FileViewer, type ViewerTarget } from './components/FileViewer.tsx'
import { FollowBar } from './components/FollowBar.tsx'
import { ForkDialog } from './components/ForkDialog.tsx'
import { NewRoomDialog } from './components/NewRoomDialog.tsx'
import { PasswordGate } from './components/PasswordGate.tsx'
import { ResizeHandle } from './components/ResizeHandle.tsx'
import { RoomHeader } from './components/RoomHeader.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Thread } from './components/Thread.tsx'
import { useDockWidth, useIsDesktop } from './lib/layout.ts'
import { usePresenceReporter } from './lib/presence.ts'
import { describeSelection, paintSelections, previewHighlights } from './lib/selection.ts'
import { applyTheme, storedTheme, watchSystemTheme } from './lib/theme.ts'
import { useStore } from './store.ts'

export function App() {
	const store = useStore()

	const [filesOpen, setFilesOpen] = useState(false)
	const [viewing, setViewing] = useState<ViewerTarget | null>(null)
	const [navOpen, setNavOpen] = useState(false)
	const [pendingArchive, setPendingArchive] = useState<Room | null>(null)
	const [pendingErase, setPendingErase] = useState<Room | null>(null)
	const [creating, setCreating] = useState(false)
	const [adminOpen, setAdminOpen] = useState(false)
	const [forking, setForking] = useState(false)
	const [forkBusy, setForkBusy] = useState(false)
	const [createBusy, setCreateBusy] = useState(false)
	const [createError, setCreateError] = useState<string | null>(null)
	const [chatScroll, setChatScroll] = useState(0)
	const [fileScroll, setFileScroll] = useState(0)
	const [selection, setSelection] = useState<SelectionAnchor | null>(null)

	const isDesktop = useIsDesktop()
	const [dockWidth, setDockWidth, resetDockWidth] = useDockWidth()

	// Once only: init() decides on its own whether there is a usable session.
	const started = useRef(false)
	useEffect(() => {
		if (started.current) return
		started.current = true
		void store.init()
	}, [store])

	// 'system' must follow the OS while the app stays open.
	useEffect(() => watchSystemTheme(() => applyTheme(storedTheme())), [])

	useEffect(() => {
		const onSelectionChange = () => setSelection(describeSelection())
		document.addEventListener('selectionchange', onSelectionChange)
		return () => document.removeEventListener('selectionchange', onSelectionChange)
	}, [])

	// Everyone's selection is painted at all times, not only while following:
	// that is what makes presence readable.
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

	if (!store.authReady) {
		return (
			<div className="flex min-h-dvh items-center justify-center bg-canvas text-[13px] text-muted">
				Loading…
			</div>
		)
	}

	if (!store.session?.user) {
		return (
			<AuthGate
				session={store.session ?? { user: null, needsSetup: false, signupEnabled: false }}
				onSignIn={store.signIn}
				onSignUp={store.signUp}
			/>
		)
	}

	// A temporary password gets nobody further than this screen.
	if (store.session.user.mustChangePassword) {
		return <PasswordGate name={store.session.user.name} onDone={() => void store.init()} />
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
			{/* Fixed column from md up, sliding drawer below. */}
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
					onDelete={(id) => setPendingArchive(store.rooms.find((room) => room.id === id) ?? null)}
					archived={store.archived}
					onLoadArchived={() => void store.loadArchived()}
					onRestore={(id) => void store.restoreRoom(id)}
					onDeleteForever={(id) =>
						setPendingErase(store.archived.find((room) => room.id === id) ?? null)
					}
					onSignOut={() => void store.signOut()}
					onOpenAdmin={() => setAdminOpen(true)}
					role={store.session.user.role}
					email={store.session.user.email}
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
					aria-label="Close the menu"
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
							onFork={() => setForking(true)}
							canManage={store.session.user.role === 'admin'}
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
						{store.loading ? 'Loading…' : 'Pick a conversation'}
					</div>
				)}
			</main>

			{/* Resizable dock on desktop, full screen on mobile. */}
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
							// The server returns the exact reason the clone failed.
							const detail = error instanceof Error ? error.message : String(error)
							setCreateError(detail.replace(/^\d+\s*/, ''))
						} finally {
							setCreateBusy(false)
						}
					}}
				/>
			)}

			{forking && store.room && (
				<ForkDialog
					sourceTitle={store.room.title}
					busy={forkBusy}
					onCancel={() => setForking(false)}
					onFork={async (title) => {
						setForkBusy(true)
						try {
							await store.forkRoom(store.room!.id, title)
							setForking(false)
						} finally {
							setForkBusy(false)
						}
					}}
				/>
			)}

			{adminOpen && store.session.user.role === 'admin' && (
				<AdminPanel selfId={store.session.user.id} onClose={() => setAdminOpen(false)} />
			)}

			{pendingArchive && (
				<ConfirmDialog
					title="Archive this conversation?"
					message="It leaves the list, and nothing is erased: history, files and context stay. Restore it from the Archived section whenever you need it."
					detail={pendingArchive.title}
					confirmLabel="Archive"
					onCancel={() => setPendingArchive(null)}
					onConfirm={() => {
						void store.archiveRoom(pendingArchive.id)
						setPendingArchive(null)
						setNavOpen(false)
					}}
				/>
			)}

			{pendingErase && (
				<ConfirmDialog
					title="Delete permanently?"
					message="The history and the working directory of this room are erased for good. This one cannot be undone."
					detail={pendingErase.title}
					confirmLabel="Delete for good"
					onCancel={() => setPendingErase(null)}
					onConfirm={() => {
						void store.deleteRoomForever(pendingErase.id)
						setPendingErase(null)
					}}
				/>
			)}
		</div>
	)
}
