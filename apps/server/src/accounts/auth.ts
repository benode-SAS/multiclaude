import { AsyncLocalStorage } from 'node:async_hooks'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { config } from '../config.ts'
import * as authSchema from '../db/auth-schema.ts'
import { db } from '../db/index.ts'
import { AccountService } from './service.ts'
import { SettingsService } from './settings.ts'

/**
 * Marks the sign-up as coming from an admin. Scoped to the call rather than a
 * module flag, so a public sign-up running at the same moment is unaffected.
 */
export const adminCreation = new AsyncLocalStorage<boolean>()

/**
 * Local accounts: email and password, sessions in the database, no external
 * service. A self-hosted instance has to work without a network dependency.
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
		// No mail service to configure before getting started.
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
				// Cannot be a static flag: the very first account must be creatable
				// from the UI even with signups closed.
				before: async () => {
					if (adminCreation.getStore()) return undefined
					const existing = await AccountService.count()
					if (existing > 0 && !SettingsService.signupEnabled()) {
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
		// A lab instance often runs over http on an internal network, where a
		// `secure` cookie would make signing in impossible.
		useSecureCookies: config.publicUrl.startsWith('https://'),
	},
})

export type AuthUser = {
	id: string
	name: string
	email: string
	role: 'admin' | 'member'
}
