import { useEffect, useState } from 'react'
import { AuthPanel } from './components/AuthPanel.tsx'
import { Composer } from './components/Composer.tsx'
import { FilesPanel } from './components/FilesPanel.tsx'
import { FileViewer, type ViewerTarget } from './components/FileViewer.tsx'
import { PseudoGate } from './components/PseudoGate.tsx'
import { RoomHeader } from './components/RoomHeader.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Thread } from './components/Thread.tsx'
import { applyTheme, storedTheme, watchSystemTheme } from './lib/theme.ts'
import { storedPseudo, useStore } from './store.ts'

export function App() {
	const store = useStore()
	const [gate, setGate] = useState(!storedPseudo())
	const [filesOpen, setFilesOpen] = useState(false)
	const [viewing, setViewing] = useState<ViewerTarget | null>(null)

	useEffect(() => {
		const pseudo = storedPseudo()
		if (pseudo && !store.pseudo) void store.init(pseudo)
	}, [store])

	// 'system' must follow the OS while the app stays open.
	useEffect(() => watchSystemTheme(() => applyTheme(storedTheme())), [])

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

	return (
		<div className="flex h-full">
			<Sidebar
				rooms={store.rooms}
				activeRoomId={store.activeRoomId}
				pseudo={store.pseudo}
				connected={store.connected}
				onSelect={store.selectRoom}
				onCreate={() => void store.createRoom()}
				onRename={(id, title) => void store.renameRoom(id, title)}
				onDelete={(id) => void store.deleteRoom(id)}
				onChangePseudo={() => setGate(true)}
				theme={store.theme}
				onSetTheme={store.setTheme}
				sound={store.sound}
				onToggleSound={store.toggleSound}
			/>

			<main className="flex min-w-0 flex-1 flex-col">
				{store.room ? (
					<>
						<RoomHeader
							room={store.room}
							status={store.status}
							participants={store.participants}
							filesOpen={filesOpen}
							onToggleFiles={() => setFilesOpen((v) => !v)}
							onRename={(title) => void store.renameRoom(store.room!.id, title)}
							onSetModel={store.setModel}
							onStop={store.stopTurn}
						/>

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
							<div className="flex items-center gap-2 border-b border-danger/30 bg-danger-soft px-6 py-2 text-[13px] text-danger">
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
						/>

						<Composer
							roomId={store.room.id}
							status={store.status}
							typing={store.typing}
							onSend={store.sendMessage}
							onTyping={store.setTyping}
						/>
					</>
				) : (
					<div className="flex flex-1 items-center justify-center text-[14px] text-muted">
						{store.loading ? 'Chargement…' : 'Sélectionne une conversation'}
					</div>
				)}
			</main>

			{filesOpen && store.room && (
				<FilesPanel
					roomId={store.room.id}
					revision={store.attachments.length}
					onOpen={setViewing}
				/>
			)}

			{viewing && store.room && (
				<FileViewer target={viewing} roomId={store.room.id} onClose={() => setViewing(null)} />
			)}
		</div>
	)
}
