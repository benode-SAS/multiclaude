import type { AuthState } from '@multiclaude/shared'
import { useState } from 'react'
import { Icon } from './Icon.tsx'

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

	// Also shown while a login runs, and on an auth error even if the CLI still
	// reports a stored account — otherwise an expired token has no way out.
	if (auth.loggedIn && !auth.pending && !auth.error) return null

	const headline = auth.pending
		? 'Connexion en cours — ouvre le lien, puis colle le code (ou l’URL de redirection).'
		: auth.error
			? 'La connexion Claude Code a été refusée. Reconnecte le compte pour continuer.'
			: 'Claude Code n’est pas connecté. Connecte ton compte pour utiliser ton abonnement.'

	return (
		<div className="border-b border-warn/30 bg-warn-soft px-4 py-3 md:px-6">
			<div className="mx-auto flex max-w-3xl flex-col gap-3">
				<div className="flex items-center gap-3">
					<Icon name="key" size={15} className="shrink-0 text-accent-ink" />
					<span className="flex-1 text-[13px] font-medium text-warn">{headline}</span>
					{!auth.pending && (
						<button
							type="button"
							onClick={onStart}
							disabled={busy}
							className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-on-accent transition enabled:hover:brightness-95 disabled:opacity-50"
						>
							{busy ? 'Démarrage…' : auth.error ? 'Se reconnecter' : 'Se connecter'}
						</button>
					)}
				</div>

				{auth.pending && auth.loginUrl && (
					<a
						href={auth.loginUrl}
						target="_blank"
						rel="noreferrer"
						className="truncate rounded-lg border border-warn/30 bg-surface px-3 py-2 font-mono text-[12px] text-accent-ink underline"
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
							className="flex-1 rounded-lg border border-warn/30 bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent/60"
						/>
						<button
							type="submit"
							disabled={busy || !code.trim()}
							className="rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-on-accent transition enabled:hover:brightness-95 disabled:opacity-40"
						>
							{busy ? 'Validation…' : 'Valider'}
						</button>
						<button
							type="button"
							onClick={onCancel}
							className="rounded-lg border border-warn/30 bg-surface px-3 py-2 text-[13px] transition hover:bg-panel"
						>
							Annuler
						</button>
					</form>
				)}

				{auth.error && <p className="text-[12px] text-danger">{auth.error}</p>}
			</div>
		</div>
	)
}
