import type { AuthState } from '@multiclaude/shared'
import { useState } from 'react'

export function AuthPanel({
	auth,
	busy,
	onStart,
	onSubmitCode,
	onCancel,
}: {
	auth: AuthState
	busy: boolean
	onStart: () => void
	onSubmitCode: (code: string) => void
	onCancel: () => void
}) {
	const [code, setCode] = useState('')

	if (auth.loggedIn) return null

	return (
		<div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
			<div className="mx-auto flex max-w-3xl flex-col gap-3">
				<div className="flex items-center gap-3">
					<span>🔑</span>
					<span className="flex-1 text-[13px] font-medium text-amber-900">
						{auth.pending
							? 'Connexion en cours — ouvre le lien, puis colle le code (ou l’URL de redirection).'
							: 'Claude Code n’est pas connecté. Connecte ton compte pour utiliser ton abonnement.'}
					</span>
					{!auth.pending && (
						<button
							type="button"
							onClick={onStart}
							disabled={busy}
							className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition enabled:hover:brightness-95 disabled:opacity-50"
						>
							{busy ? 'Démarrage…' : 'Se connecter'}
						</button>
					)}
				</div>

				{auth.pending && auth.loginUrl && (
					<a
						href={auth.loginUrl}
						target="_blank"
						rel="noreferrer"
						className="truncate rounded-lg border border-amber-200 bg-surface px-3 py-2 font-mono text-[12px] text-accent underline"
					>
						{auth.loginUrl}
					</a>
				)}

				{auth.pending && (
					<form
						onSubmit={(e) => {
							e.preventDefault()
							if (code.trim()) {
								onSubmitCode(code.trim())
								setCode('')
							}
						}}
						className="flex gap-2"
					>
						<input
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="Colle ici le code ou l’URL de redirection"
							className="flex-1 rounded-lg border border-amber-200 bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent/60"
						/>
						<button
							type="submit"
							disabled={busy || !code.trim()}
							className="rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white transition enabled:hover:brightness-95 disabled:opacity-40"
						>
							{busy ? 'Validation…' : 'Valider'}
						</button>
						<button
							type="button"
							onClick={onCancel}
							className="rounded-lg border border-amber-200 bg-surface px-3 py-2 text-[13px] transition hover:bg-panel"
						>
							Annuler
						</button>
					</form>
				)}

				{auth.error && <p className="text-[12px] text-red-700">{auth.error}</p>}
			</div>
		</div>
	)
}
