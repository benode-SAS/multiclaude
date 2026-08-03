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
		console.warn('[accounts] ADMIN_PASSWORD trop court (8 caractères minimum), compte non créé')
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
			console.log(`[accounts] administrateur créé : ${config.adminEmail}`)
		}
	} catch (error) {
		console.error(
			'[accounts] création du compte administrateur impossible :',
			error instanceof Error ? error.message : error,
		)
	}
}
