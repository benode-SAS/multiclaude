import {
	type AccountSummary,
	type AdminConfig,
	MODELS,
	modelLabel,
	type Role,
} from '@multiclaude/shared'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { formatDay } from '../lib/format.ts'
import { Avatar } from './Avatar.tsx'
import { Icon } from './Icon.tsx'

type Tab = 'accounts' | 'config'

const duration = (seconds: number) => {
	if (seconds < 60) return `${seconds}s`
	if (seconds < 3600) return `${Math.round(seconds / 60)}min`
	if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
	return `${Math.round(seconds / 86400)}d`
}

/**
 * Accounts and settings. An overlay rather than a dedicated route: the app has
 * no router, and this is a short round trip.
 */
export function AdminPanel({ selfId, onClose }: { selfId: string; onClose: () => void }) {
	const [tab, setTab] = useState<Tab>('accounts')
	const [accounts, setAccounts] = useState<AccountSummary[] | null>(null)
	const [config, setConfig] = useState<AdminConfig | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState<string | null>(null)
	const [confirmDelete, setConfirmDelete] = useState<AccountSummary | null>(null)
	const [adding, setAdding] = useState(false)
	const [newName, setNewName] = useState('')
	const [newEmail, setNewEmail] = useState('')
	const [newAdmin, setNewAdmin] = useState(false)
	/** Shown once, per account: it is never retrievable afterwards. */
	const [issued, setIssued] = useState<{ email: string; password: string } | null>(null)

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onClose])

	useEffect(() => {
		void Promise.all([api.accounts(), api.adminConfig()])
			.then(([list, cfg]) => {
				setAccounts(list)
				setConfig(cfg)
			})
			// The server states the reason, prefixed by the HTTP code we drop here.
			.catch((cause: unknown) => setError(clean(cause)))
	}, [])

	const run = async (key: string, action: () => Promise<void>) => {
		setBusy(key)
		setError(null)
		try {
			await action()
		} catch (cause) {
			setError(clean(cause))
		} finally {
			setBusy(null)
		}
	}

	const setRole = (account: AccountSummary, role: Role) =>
		run(account.id, async () => {
			const updated = await api.setAccountRole(account.id, role)
			setAccounts((list) => list?.map((a) => (a.id === updated.id ? updated : a)) ?? null)
		})

	const remove = (account: AccountSummary) =>
		run(account.id, async () => {
			await api.removeAccount(account.id)
			setAccounts((list) => list?.filter((a) => a.id !== account.id) ?? null)
			setConfirmDelete(null)
		})

	const create = () =>
		run('create', async () => {
			const { account, temporaryPassword } = await api.createAccount({
				email: newEmail.trim(),
				name: newName.trim() || newEmail.trim().split('@')[0]!,
				role: newAdmin ? 'admin' : 'member',
			})
			setAccounts((list) => [...(list ?? []), account])
			setIssued({ email: account.email, password: temporaryPassword })
			setAdding(false)
			setNewName('')
			setNewEmail('')
			setNewAdmin(false)
		})

	const resetPassword = (account: AccountSummary) =>
		run(account.id, async () => {
			const { temporaryPassword } = await api.resetAccountPassword(account.id)
			setIssued({ email: account.email, password: temporaryPassword })
			setAccounts(
				(list) =>
					list?.map((a) => (a.id === account.id ? { ...a, mustChangePassword: true } : a)) ?? null,
			)
		})

	const save = (patch: { signupEnabled?: boolean; defaultModel?: string | null }) =>
		run('config', async () => {
			const settings = await api.saveAdminConfig(patch)
			setConfig((current) => (current ? { ...current, settings } : current))
		})

	return (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-0 sm:p-4">
			<button
				type="button"
				aria-label="Close"
				onClick={onClose}
				className="absolute inset-0 cursor-default"
			/>

			<div className="relative flex h-dvh w-full flex-col overflow-hidden border-line bg-canvas shadow-2xl sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl sm:border">
				<header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
					<h2 className="flex-1 text-[15px] font-semibold">Administration</h2>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg px-2 py-1 text-[15px] text-muted transition hover:bg-panel hover:text-ink"
					>
						<Icon name="close" size={16} label="Close" />
					</button>
				</header>

				<nav className="flex shrink-0 gap-1 border-b border-line px-3 py-2">
					{(
						[
							['accounts', 'Users'],
							['config', 'Settings'],
						] as Array<[Tab, string]>
					).map(([id, label]) => (
						<button
							key={id}
							type="button"
							onClick={() => setTab(id)}
							className={clsx(
								'rounded-lg px-3 py-1.5 text-[13px] transition',
								tab === id ? 'bg-surface font-medium text-ink' : 'text-muted hover:text-ink',
							)}
						>
							{label}
						</button>
					))}
				</nav>

				{error && (
					<p className="shrink-0 border-b border-danger/30 bg-danger-soft px-4 py-2 text-[12px] text-danger">
						{error}
					</p>
				)}

				<div className="min-h-0 flex-1 overflow-y-auto p-4">
					{tab === 'accounts' ? (
						!accounts ? (
							<p className="text-[13px] text-muted">Loading…</p>
						) : (
							<ul className="flex flex-col gap-1.5">
								{accounts.map((account) => (
									<li
										key={account.id}
										className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5"
									>
										<Avatar author={account.name} size={28} />
										<div className="min-w-0 flex-1">
											<div className="truncate text-[14px] font-medium">
												{account.name}
												{account.id === selfId && (
													<span className="ml-1.5 text-[11px] text-muted">— you</span>
												)}
											</div>
											<div className="truncate text-[11px] text-muted">
												{account.email} · joined {formatDay(account.createdAt)}
												{account.mustChangePassword && ' · password to change'}
											</div>
										</div>

										<select
											value={account.role}
											disabled={busy === account.id}
											onChange={(e) => void setRole(account, e.target.value as Role)}
											className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-[13px] outline-none focus:border-accent/60 disabled:opacity-50"
										>
											<option value="admin">Admin</option>
											<option value="member">Member</option>
										</select>

										<button
											type="button"
											disabled={busy === account.id}
											onClick={() => void resetPassword(account)}
											title="Regenerate the password"
											className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-[13px] text-muted transition enabled:hover:text-ink disabled:opacity-40"
										>
											<Icon name="key" size={14} label="Regenerate the password" />
										</button>

										<button
											type="button"
											disabled={account.id === selfId || busy === account.id}
											onClick={() => setConfirmDelete(account)}
											title={
												account.id === selfId
													? 'You cannot delete your own account'
													: 'Delete the account'
											}
											className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-[13px] text-muted transition enabled:hover:border-danger/50 enabled:hover:text-danger disabled:opacity-40"
										>
											<Icon name="trash" size={14} label="Delete the account" />
										</button>
									</li>
								))}

								<li className="mt-2">
									{adding ? (
										<form
											onSubmit={(e) => {
												e.preventDefault()
												void create()
											}}
											className="rounded-xl border border-line bg-surface p-3"
										>
											<div className="flex flex-col gap-2 sm:flex-row">
												<input
													autoFocus
													value={newName}
													onChange={(e) => setNewName(e.target.value)}
													placeholder="Display name"
													className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-2 text-[14px] outline-none focus:border-accent/60"
												/>
												<input
													type="email"
													required
													value={newEmail}
													onChange={(e) => setNewEmail(e.target.value)}
													placeholder="name@example.com"
													className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-2 text-[14px] outline-none focus:border-accent/60"
												/>
											</div>

											<label className="mt-2 flex items-center gap-2 text-[12px] text-muted">
												<input
													type="checkbox"
													checked={newAdmin}
													onChange={(e) => setNewAdmin(e.target.checked)}
													className="size-4 accent-[var(--color-accent)]"
												/>
												Admin
											</label>

											<div className="mt-3 flex justify-end gap-2">
												<button
													type="button"
													onClick={() => setAdding(false)}
													className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-[13px] transition hover:bg-panel"
												>
													Cancel
												</button>
												<button
													type="submit"
													disabled={busy === 'create'}
													className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-on-accent transition enabled:hover:brightness-95 disabled:opacity-60"
												>
													{busy === 'create' ? '…' : 'Create the account'}
												</button>
											</div>
										</form>
									) : (
										<button
											type="button"
											onClick={() => setAdding(true)}
											className="w-full rounded-xl border border-line border-dashed bg-surface px-3 py-2.5 text-[13px] text-muted transition hover:border-accent/50 hover:text-ink"
										>
											+ Add a member
										</button>
									)}
								</li>
							</ul>
						)
					) : !config ? (
						<p className="text-[13px] text-muted">Loading…</p>
					) : (
						<div className="flex flex-col gap-4">
							<section className="rounded-xl border border-line bg-surface p-3">
								<h3 className="text-[13px] font-medium">Signups</h3>
								<label className="mt-2 flex items-start gap-2 text-[13px]">
									<input
										type="checkbox"
										checked={config.settings.signupEnabled}
										disabled={busy === 'config'}
										onChange={(e) => void save({ signupEnabled: e.target.checked })}
										className="mt-0.5 size-4 accent-[var(--color-accent)]"
									/>
									<span>
										Open to anyone
										<span className="block text-[11px] text-muted">
											Closed, only an admin creates accounts. This setting overrides{' '}
											<code>SIGNUP_ENABLED</code> (
											{config.runtime.signupFromEnv ? 'open' : 'closed'} in the <code>.env</code>
											).
										</span>
									</span>
								</label>
							</section>

							<section className="rounded-xl border border-line bg-surface p-3">
								<h3 className="text-[13px] font-medium">Model for new conversations</h3>
								<select
									value={config.settings.defaultModel ?? ''}
									disabled={busy === 'config'}
									onChange={(e) => void save({ defaultModel: e.target.value || null })}
									className="mt-2 w-full rounded-lg border border-line bg-canvas px-2 py-2 text-[13px] outline-none focus:border-accent/60 disabled:opacity-50"
								>
									{MODELS.map((model) => (
										<option key={model.id ?? 'default'} value={model.id ?? ''}>
											{model.label}
										</option>
									))}
								</select>
								<p className="mt-1.5 text-[11px] text-muted">
									Every conversation stays individually adjustable; this only sets the starting
									value.
								</p>
							</section>

							<section className="rounded-xl border border-line bg-surface p-3">
								<h3 className="text-[13px] font-medium">Server state</h3>
								{/* Showing what the .env resolved to saves a trip to the server
								    when diagnosing a behaviour. */}
								<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
									<Row label="Claude account">
										{config.runtime.claudeLoggedIn ? 'connected' : 'not connected'}
									</Row>
									<Row label="Binary">{config.runtime.claudeBin}</Row>
									<Row label="Public URL">{config.runtime.publicUrl}</Row>
									<Row label="Data">{config.runtime.dataDir}</Row>
									<Row label="Front served">{config.runtime.serveWeb ? 'yes' : 'no'}</Row>
									<Row label="Accounts">{config.runtime.accounts}</Row>
									<Row label="Conversations">{config.runtime.rooms}</Row>
									<Row label="Uptime">{duration(config.runtime.uptimeSec)}</Row>
									<Row label="Default model">{modelLabel(config.settings.defaultModel)}</Row>
									<Row label="Permission timeout">
										{duration(config.runtime.permissionTimeoutSec)}
									</Row>
									<Row label="Always-confirmed tools">
										{config.runtime.alwaysAskTools.join(', ') || 'none — per-command policy'}
									</Row>
									<Row label="Patterns to confirm">
										{config.runtime.askPatterns.join(', ') || 'none'}
									</Row>
									<Row label="Clone depth">{config.runtime.cloneDepth || 'full history'}</Row>
									<Row label="Upload limit">{config.runtime.maxUploadMb} MB</Row>
								</dl>
								<p className="mt-2 text-[11px] text-muted">
									These values come from the environment: change them in the <code>.env</code>, then
									restart.
								</p>
							</section>
						</div>
					)}
				</div>
			</div>

			{issued && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
					<div className="w-full max-w-sm rounded-2xl border border-line bg-canvas p-5 shadow-2xl">
						<h3 className="text-[15px] font-semibold">Temporary password</h3>
						<p className="mt-2 text-[13px] text-muted">
							Pass it on to {issued.email}. They will be asked to change it at sign-in, and it will
							not be shown here again.
						</p>
						<code className="mt-3 block break-all rounded-xl border border-line bg-surface px-3 py-2.5 text-center font-mono text-[15px]">
							{issued.password}
						</code>
						<div className="mt-4 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => void navigator.clipboard?.writeText(issued.password)}
								className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] transition hover:bg-panel"
							>
								Copy
							</button>
							<button
								type="button"
								onClick={() => setIssued(null)}
								className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-on-accent transition hover:brightness-95"
							>
								Got it
							</button>
						</div>
					</div>
				</div>
			)}

			{confirmDelete && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
					<div className="w-full max-w-sm rounded-2xl border border-line bg-canvas p-5 shadow-2xl">
						<h3 className="text-[15px] font-semibold">Delete this account?</h3>
						<p className="mt-2 text-[13px] text-muted">
							{confirmDelete.name} ({confirmDelete.email}) loses access immediately. Conversations
							and messages stay in place.
						</p>
						<div className="mt-5 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setConfirmDelete(null)}
								className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] transition hover:bg-panel"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={busy === confirmDelete.id}
								onClick={() => void remove(confirmDelete)}
								className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-medium text-white transition enabled:hover:brightness-95 disabled:opacity-60"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

const clean = (cause: unknown) =>
	(cause instanceof Error ? cause.message : String(cause)).replace(/^\d{3}\s*/, '')

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<>
			<dt className="text-muted">{label}</dt>
			<dd className="min-w-0 break-all font-mono text-[11px]">{children}</dd>
		</>
	)
}
