import type { SessionInfo } from '@multiclaude/shared'
import { useState } from 'react'

type Mode = 'sign-in' | 'sign-up'

/**
 * Entry screen. With no account there is nothing to choose: it asks straight
 * for the admin account, or a fresh instance with signups closed would stay
 * unusable.
 */
export function AuthGate({
	session,
	onSignIn,
	onSignUp,
}: {
	session: SessionInfo
	onSignIn: (email: string, password: string) => Promise<void>
	onSignUp: (email: string, password: string, name: string) => Promise<void>
}) {
	const setup = session.needsSetup
	const [mode, setMode] = useState<Mode>(setup ? 'sign-up' : 'sign-in')
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const registering = setup || mode === 'sign-up'
	const canRegister = setup || session.signupEnabled

	const submit = async () => {
		setBusy(true)
		setError(null)
		try {
			if (registering) await onSignUp(email.trim(), password, name.trim() || email.split('@')[0]!)
			else await onSignIn(email.trim(), password)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause))
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
				<h1 className="text-lg font-semibold tracking-tight">multiclaude</h1>
				<p className="mt-1 mb-5 text-[13px] text-muted">
					{setup
						? 'No account yet — this one will be the admin.'
						: registering
							? 'Create an account to join the conversations.'
							: 'Sign in to reach the conversations.'}
				</p>

				{registering && (
					<label className="mb-3 block text-[12px] text-muted" htmlFor="auth-name">
						Display name
						<input
							id="auth-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							autoComplete="nickname"
							placeholder="Benjamin"
							className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[15px] text-ink outline-none focus:border-accent/60"
						/>
					</label>
				)}

				<label className="mb-3 block text-[12px] text-muted" htmlFor="auth-email">
					Email
					<input
						id="auth-email"
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoComplete="email"
						className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[15px] text-ink outline-none focus:border-accent/60"
					/>
				</label>

				<label className="block text-[12px] text-muted" htmlFor="auth-password">
					Password
					<input
						id="auth-password"
						type="password"
						required
						minLength={8}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete={registering ? 'new-password' : 'current-password'}
						className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[15px] text-ink outline-none focus:border-accent/60"
					/>
					{registering && <span className="mt-1 block text-[11px]">8 characters minimum</span>}
				</label>

				{error && <p className="mt-3 text-[12px] text-danger">{error}</p>}

				<button
					type="submit"
					disabled={busy}
					className="mt-5 w-full rounded-xl bg-accent py-2.5 text-[14px] font-medium text-on-accent transition enabled:hover:brightness-95 disabled:opacity-50"
				>
					{busy
						? '…'
						: setup
							? 'Create the admin account'
							: registering
								? 'Create the account'
								: 'Sign in'}
				</button>

				{!setup && canRegister && (
					<button
						type="button"
						onClick={() => {
							setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
							setError(null)
						}}
						className="mt-3 w-full text-[12px] text-muted transition hover:text-ink"
					>
						{mode === 'sign-in' ? 'No account yet? Create one' : 'I already have an account'}
					</button>
				)}

				{!setup && !session.signupEnabled && mode === 'sign-in' && (
					<p className="mt-3 text-center text-[11px] text-muted">
						Signups are closed — ask an admin for an account.
					</p>
				)}
			</form>
		</div>
	)
}
