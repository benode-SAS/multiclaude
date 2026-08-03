import type { AdminConfig, SessionInfo } from '@multiclaude/shared'
import { Elysia, status, t } from 'elysia'
import { claudeBin } from '../agent/claude-bin.ts'
import { AuthService } from '../auth/service.ts'
import { config } from '../config.ts'
import { RoomService } from '../rooms/service.ts'
import { auth } from './auth.ts'
import { currentUser, requireAdmin } from './guard.ts'
import { AccountService } from './service.ts'
import { SettingsService } from './settings.ts'

/**
 * Better Auth gère lui-même /api/auth/* (inscription, connexion, session).
 * Le reste ici sert à ce que le front sait avant d'afficher quoi que ce soit,
 * et à l'administration des comptes.
 */
export const accountRoutes = new Elysia({ prefix: '/api' })
	.mount(auth.handler)

	.get('/session', async ({ request }): Promise<SessionInfo> => {
		const total = await AccountService.count()
		return {
			user: await currentUser(request),
			// Personne encore : le front propose la création du compte administrateur.
			needsSetup: total === 0,
			signupEnabled: SettingsService.signupEnabled(),
		}
	})

	.get('/admin/config', async ({ request }) => {
		const denied = await requireAdmin(request)
		if (denied) return denied
		const payload: AdminConfig = {
			settings: SettingsService.all(),
			runtime: {
				publicUrl: config.publicUrl,
				dataDir: config.dataDir,
				serveWeb: config.serveWeb,
				signupFromEnv: config.signupEnabled,
				permissionTimeoutSec: config.permissionTimeoutSec,
				alwaysAskTools: [...config.alwaysAskTools],
				askPatterns: config.askPatterns.map((p) => p.source),
				cloneDepth: config.cloneDepth,
				maxUploadMb: Math.round(config.maxUploadBytes / 1024 / 1024),
				claudeBin,
				claudeLoggedIn: (await AuthService.status()).loggedIn,
				accounts: await AccountService.count(),
				rooms: (await RoomService.list()).length,
				uptimeSec: Math.round(process.uptime()),
			},
		}
		return payload
	})

	.patch(
		'/admin/config',
		async ({ request, body }) => {
			const denied = await requireAdmin(request)
			if (denied) return denied
			return SettingsService.update(body)
		},
		{
			body: t.Object({
				signupEnabled: t.Optional(t.Boolean()),
				defaultModel: t.Optional(t.Union([t.String(), t.Null()])),
			}),
		},
	)

	.get('/accounts', async ({ request }) => {
		const denied = await requireAdmin(request)
		if (denied) return denied
		return AccountService.list()
	})

	.patch(
		'/accounts/:id/role',
		async ({ request, params, body }) => {
			const denied = await requireAdmin(request)
			if (denied) return denied

			const me = await currentUser(request)
			// Se retirer soi-même le dernier rôle admin fermerait la porte à clé
			// de l'intérieur : plus personne ne pourrait régler quoi que ce soit.
			if (
				me?.id === params.id &&
				body.role === 'member' &&
				(await AccountService.adminCount()) <= 1
			) {
				return status(409, 'Il doit rester au moins un administrateur')
			}

			const updated = await AccountService.setRole(params.id, body.role)
			return updated ?? status(404, 'Not Found')
		},
		{ body: t.Object({ role: t.Union([t.Literal('admin'), t.Literal('member')]) }) },
	)

	.delete('/accounts/:id', async ({ request, params }) => {
		const denied = await requireAdmin(request)
		if (denied) return denied

		const me = await currentUser(request)
		if (me?.id === params.id) return status(409, 'On ne supprime pas son propre compte')

		const target = await AccountService.get(params.id)
		if (!target) return status(404, 'Not Found')
		if (target.role === 'admin' && (await AccountService.adminCount()) <= 1) {
			return status(409, 'Il doit rester au moins un administrateur')
		}

		await AccountService.remove(params.id)
		return { ok: true }
	})
