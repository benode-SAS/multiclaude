import { useEffect, useRef, useState } from 'react'

/** An SSH URL authenticates with the host's key; a token would be pointless. */
const isHttp = (url: string) => /^https?:\/\//i.test(url.trim())

/**
 * The clone runs before the room is handed over: a turn started on a half
 * cloned directory would produce nonsense. Hence the busy state, which can
 * last a while.
 */
export function NewRoomDialog({
	busy,
	error,
	onCreate,
	onCancel,
}: {
	busy: boolean
	error: string | null
	onCreate: (input: { title?: string; repoUrl?: string; branch?: string; token?: string }) => void
	onCancel: () => void
}) {
	const [title, setTitle] = useState('')
	const [repoUrl, setRepoUrl] = useState('')
	const [branch, setBranch] = useState('')
	const [token, setToken] = useState('')
	const titleRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		titleRef.current?.focus()
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !busy) onCancel()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onCancel, busy])

	const submit = () => {
		if (busy) return
		onCreate({
			title: title.trim() || undefined,
			repoUrl: repoUrl.trim() || undefined,
			branch: branch.trim() || undefined,
			token: token.trim() || undefined,
		})
	}

	return (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
			<button
				type="button"
				aria-label="Annuler"
				onClick={() => !busy && onCancel()}
				className="absolute inset-0 cursor-default"
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault()
					submit()
				}}
				className="relative w-full max-w-md rounded-2xl border border-line bg-canvas p-5 shadow-2xl"
			>
				<h2 className="text-[15px] font-semibold">Nouvelle conversation</h2>

				<label className="mt-4 block text-[12px] text-muted" htmlFor="room-title">
					Titre
					<input
						id="room-title"
						ref={titleRef}
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Nouvelle conversation"
						disabled={busy}
						className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-accent/60 disabled:opacity-50"
					/>
				</label>

				<label className="mt-3 block text-[12px] text-muted" htmlFor="room-repo">
					Dépôt à cloner — optionnel
					<input
						id="room-repo"
						value={repoUrl}
						onChange={(e) => setRepoUrl(e.target.value)}
						placeholder="https://github.com/org/projet.git"
						disabled={busy}
						className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-accent/60 disabled:opacity-50"
					/>
				</label>

				{repoUrl.trim() && (
					<>
						<label className="mt-3 block text-[12px] text-muted" htmlFor="room-branch">
							Branche — optionnel
							<input
								id="room-branch"
								value={branch}
								onChange={(e) => setBranch(e.target.value)}
								placeholder="main"
								disabled={busy}
								className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-accent/60 disabled:opacity-50"
							/>
						</label>

						{isHttp(repoUrl) && (
							<label className="mt-3 block text-[12px] text-muted" htmlFor="room-token">
								Jeton d'accès — dépôt privé
								<input
									id="room-token"
									type="password"
									value={token}
									onChange={(e) => setToken(e.target.value)}
									placeholder="ghp_… / glpat_…"
									autoComplete="off"
									disabled={busy}
									className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-accent/60 disabled:opacity-50"
								/>
							</label>
						)}
					</>
				)}

				<p className="mt-3 text-[12px] text-muted">
					Le dépôt devient le dossier de travail de la conversation. Pour un dépôt privé : un jeton
					en lecture, utilisé pour le clone puis oublié — ou une URL SSH, si le serveur a la clé.
				</p>

				{error && <p className="mt-3 text-[12px] text-danger">{error}</p>}

				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						disabled={busy}
						className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] transition hover:bg-panel disabled:opacity-50"
					>
						Annuler
					</button>
					<button
						type="submit"
						disabled={busy}
						className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition enabled:hover:brightness-95 disabled:opacity-60"
					>
						{busy ? (repoUrl.trim() ? 'Clonage…' : 'Création…') : 'Créer'}
					</button>
				</div>
			</form>
		</div>
	)
}
