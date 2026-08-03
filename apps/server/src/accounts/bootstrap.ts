import { config } from '../config.ts'
import { auth } from './auth.ts'
import { AccountService } from './service.ts'

/**
 * Creates the admin account from the environment, for unattended deployments.
 * Skipped as soon as one account exists, so a restart never overwrites a
 * password changed since.
 */
export async function bootstrapAdmin() {
	if (!config.adminEmail || !config.adminPassword) return
	if ((await AccountService.count()) > 0) return

	if (config.adminPassword.length < 8) {
		console.warn('[accounts] ADMIN_PASSWORD too short (8 characters minimum), account not created')
		return
	}

	try {
		const created = await auth.api.signUpEmail({
			body: {
				email: config.adminEmail,
				password: config.adminPassword,
				name: config.adminName,
			},
		})
		if (created?.user?.id) {
			await AccountService.setRole(created.user.id, 'admin')
			console.log(`[accounts] admin created: ${config.adminEmail}`)
		}
	} catch (error) {
		console.error(
			'[accounts] could not create the admin account:',
			error instanceof Error ? error.message : error,
		)
	}
}
