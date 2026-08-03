import { useState } from 'react'
import { api } from '../lib/api.ts'

/**
 * Shown instead of the app while the account still carries the temporary
 * password an admin handed out. Nothing else is reachable until it is replaced.
 */
export function PasswordGate({ name, onDone }: { name: string; onDone: () => void }) {
	const [current, setCurrent] = useState('')
	const [next, setNext] = useState('')
	const [confirm, setConfirm] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const submit = async () => {
		if (next !== confirm) {
			setError('Les deux mots de passe ne correspondent pas')
			return
		}
		setBusy(true)
		setError(null)
		try {
			await api.changePassword(current, next)
			onDone()
		} catch (cause) {
			const detail = cause instanceof Error ? cause.message : String(cause)
			setError(detail.replace(/^\d{3}\s*/, ''))
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
			<form
				onSubmit={(e) => {
					e.preventDefault()
					void submit()
				}}
				className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm"
			>
				<h1 className="text-lg font-semibold tracking-tight">Choisis ton mot de passe</h1>
				<p className="mt-1 mb-5 text-[13px] text-muted">
					Bonjour {name}. Ton compte a été créé avec un mot de passe temporaire : remplace-le pour
					continuer.
				</p>

				<label className="mb-3 block text-[12px] text-muted" htmlFor="pw-current">
					Mot de passe temporaire
					<input
						id="pw-current"
						type="password"
						required
						value={current}
						onChange={(e) => setCurrent(e.target.value)}
						autoComplete="current-password"
						className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[15px] text-ink outline-none focus:border-accent/60"
					/>
				</label>

				<label className="mb-3 block text-[12px] text-muted" htmlFor="pw-next">
					Nouveau mot de passe
					<input
						id="pw-next"
						type="password"
						required
						minLength={8}
						value={next}
						onChange={(e) => setNext(e.target.value)}
						autoComplete="new-password"
						className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[15px] text-ink outline-none focus:border-accent/60"
					/>
					<span className="mt-1 block text-[11px]">8 caractères minimum</span>
				</label>

				<label className="block text-[12px] text-muted" htmlFor="pw-confirm">
					Confirmation
					<input
						id="pw-confirm"
						type="password"
						required
						minLength={8}
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
						autoComplete="new-password"
						className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[15px] text-ink outline-none focus:border-accent/60"
					/>
				</label>

				{error && <p className="mt-3 text-[12px] text-danger">{error}</p>}

				<button
					type="submit"
					disabled={busy}
					className="mt-5 w-full rounded-xl bg-accent py-2.5 text-[14px] font-medium text-on-accent transition enabled:hover:brightness-95 disabled:opacity-50"
				>
					{busy ? '…' : 'Enregistrer et continuer'}
				</button>
			</form>
		</div>
	)
}
