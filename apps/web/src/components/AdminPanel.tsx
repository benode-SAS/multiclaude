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

type Tab = 'accounts' | 'config'

const duration = (seconds: number) => {
	if (seconds < 60) return `${seconds} s`
	if (seconds < 3600) return `${Math.round(seconds / 60)} min`
	if (seconds < 86400) return `${Math.round(seconds / 3600)} h`
	return `${Math.round(seconds / 86400)} j`
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

	const save = (patch: { signupEnabled?: boolean; defaultModel?: string | null }) =>
		run('config', async () => {
			const settings = await api.saveAdminConfig(patch)
			setConfig((current) => (current ? { ...current, settings } : current))
		})

	return (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-0 sm:p-4">
			<button
				type="button"
				aria-label="Fermer"
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
						✕
					</button>
				</header>

				<nav className="flex shrink-0 gap-1 border-b border-line px-3 py-2">
					{(
						[
							['accounts', 'Utilisateurs'],
							['config', 'Configuration'],
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
							<p className="text-[13px] text-muted">Chargement…</p>
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
													<span className="ml-1.5 text-[11px] text-muted">— toi</span>
												)}
											</div>
											<div className="truncate text-[11px] text-muted">
												{account.email} · inscrit le {formatDay(account.createdAt)}
											</div>
										</div>

										<select
											value={account.role}
											disabled={busy === account.id}
											onChange={(e) => void setRole(account, e.target.value as Role)}
											className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-[13px] outline-none focus:border-accent/60 disabled:opacity-50"
										>
											<option value="admin">Administrateur</option>
											<option value="member">Membre</option>
										</select>

										<button
											type="button"
											disabled={account.id === selfId || busy === account.id}
											onClick={() => setConfirmDelete(account)}
											title={
												account.id === selfId
													? 'On ne supprime pas son propre compte'
													: 'Supprimer le compte'
											}
											className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-[13px] text-muted transition enabled:hover:border-danger/50 enabled:hover:text-danger disabled:opacity-40"
										>
											🗑
										</button>
									</li>
								))}
							</ul>
						)
					) : !config ? (
						<p className="text-[13px] text-muted">Chargement…</p>
					) : (
						<div className="flex flex-col gap-4">
							<section className="rounded-xl border border-line bg-surface p-3">
								<h3 className="text-[13px] font-medium">Inscriptions</h3>
								<label className="mt-2 flex items-start gap-2 text-[13px]">
									<input
										type="checkbox"
										checked={config.settings.signupEnabled}
										disabled={busy === 'config'}
										onChange={(e) => void save({ signupEnabled: e.target.checked })}
										className="mt-0.5 size-4 accent-[var(--color-accent)]"
									/>
									<span>
										Ouvertes à tous
										<span className="block text-[11px] text-muted">
											Fermées, seul un administrateur peut créer des comptes. Ce réglage prime sur{' '}
											<code>SIGNUP_ENABLED</code> (
											{config.runtime.signupFromEnv ? 'ouvertes' : 'fermées'} dans le{' '}
											<code>.env</code>
											).
										</span>
									</span>
								</label>
							</section>

							<section className="rounded-xl border border-line bg-surface p-3">
								<h3 className="text-[13px] font-medium">Modèle des nouvelles conversations</h3>
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
									Chaque conversation reste réglable individuellement ; ceci ne fixe que la valeur
									de départ.
								</p>
							</section>

							<section className="rounded-xl border border-line bg-surface p-3">
								<h3 className="text-[13px] font-medium">État du serveur</h3>
								{/* Showing what the .env resolved to saves a trip to the server
								    when diagnosing a behaviour. */}
								<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
									<Row label="Compte Claude">
										{config.runtime.claudeLoggedIn ? 'connecté' : 'non connecté'}
									</Row>
									<Row label="Binaire">{config.runtime.claudeBin}</Row>
									<Row label="URL publique">{config.runtime.publicUrl}</Row>
									<Row label="Données">{config.runtime.dataDir}</Row>
									<Row label="Front servi">{config.runtime.serveWeb ? 'oui' : 'non'}</Row>
									<Row label="Comptes">{config.runtime.accounts}</Row>
									<Row label="Conversations">{config.runtime.rooms}</Row>
									<Row label="En ligne depuis">{duration(config.runtime.uptimeSec)}</Row>
									<Row label="Modèle par défaut">{modelLabel(config.settings.defaultModel)}</Row>
									<Row label="Attente d'autorisation">
										{duration(config.runtime.permissionTimeoutSec)}
									</Row>
									<Row label="Outils toujours confirmés">
										{config.runtime.alwaysAskTools.join(', ') || 'aucun — politique par commande'}
									</Row>
									<Row label="Motifs à confirmer">
										{config.runtime.askPatterns.join(', ') || 'aucun'}
									</Row>
									<Row label="Profondeur de clone">
										{config.runtime.cloneDepth || 'historique complet'}
									</Row>
									<Row label="Envoi maximum">{config.runtime.maxUploadMb} Mo</Row>
								</dl>
								<p className="mt-2 text-[11px] text-muted">
									Ces valeurs viennent de l'environnement : elles se changent dans le{' '}
									<code>.env</code>, puis au redémarrage.
								</p>
							</section>
						</div>
					)}
				</div>
			</div>

			{confirmDelete && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
					<div className="w-full max-w-sm rounded-2xl border border-line bg-canvas p-5 shadow-2xl">
						<h3 className="text-[15px] font-semibold">Supprimer ce compte ?</h3>
						<p className="mt-2 text-[13px] text-muted">
							{confirmDelete.name} ({confirmDelete.email}) perdra l'accès immédiatement. Les
							conversations et les messages restent en place.
						</p>
						<div className="mt-5 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setConfirmDelete(null)}
								className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] transition hover:bg-panel"
							>
								Annuler
							</button>
							<button
								type="button"
								disabled={busy === confirmDelete.id}
								onClick={() => void remove(confirmDelete)}
								className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-medium text-white transition enabled:hover:brightness-95 disabled:opacity-60"
							>
								Supprimer
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
