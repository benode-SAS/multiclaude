import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { config } from '../config.ts'
import * as authSchema from '../db/auth-schema.ts'
import { db } from '../db/index.ts'
import { AccountService } from './service.ts'

/**
 * Comptes locaux : e-mail et mot de passe, sessions en base, aucun service
 * externe. Une instance auto-hébergée doit fonctionner sans dépendance réseau.
 */
export const auth = betterAuth({
	appName: 'multiclaude',
	baseURL: config.publicUrl,
	secret: config.authSecret,
	basePath: '/api/auth',
	trustedOrigins: config.trustedOrigins,

	database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),

	emailAndPassword: {
		enabled: true,
		// Pas de service d'e-mail à configurer pour se lancer.
		requireEmailVerification: false,
		minPasswordLength: 8,
	},

	user: {
		additionalFields: {
			role: { type: 'string', required: false, defaultValue: 'member', input: false },
		},
	},

	session: {
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24,
	},

	databaseHooks: {
		user: {
			create: {
				// Le drapeau ne peut pas être statique : même inscription fermée, il
				// faut pouvoir créer le tout premier compte depuis l'interface.
				before: async () => {
					const existing = await AccountService.count()
					if (existing > 0 && !config.signupEnabled) {
						throw new APIError('FORBIDDEN', { message: 'Les inscriptions sont fermées' })
					}
					return undefined
				},
				after: async (created) => {
					await AccountService.promoteIfFirst(created.id)
				},
			},
		},
	},

	advanced: {
		// Cookie non sécurisé en clair : une instance de labo tourne souvent en
		// http sur un réseau interne, où `secure` empêcherait toute connexion.
		useSecureCookies: config.publicUrl.startsWith('https://'),
	},
})

export type AuthUser = {
	id: string
	name: string
	email: string
	role: 'admin' | 'member'
}
