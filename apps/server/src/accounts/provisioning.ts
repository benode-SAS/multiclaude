import { randomInt } from 'node:crypto'
import type { CreatedAccount, Role } from '@multiclaude/shared'
import { adminCreation, auth } from './auth.ts'
import { AccountService } from './service.ts'

/**
 * Ambiguous characters are left out: this password gets read aloud, copied from
 * a chat window, or typed from a sticky note before being replaced.
 */
const ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789'

export const temporaryPassword = (length = 14) =>
	Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

const reason = (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error)
	return /exist/i.test(message) ? 'An account already uses this address' : message
}

/**
 * Creates an account on someone's behalf, whatever the signup setting says:
 * this path is the admin's, and closing signups is about the public form.
 */
export async function createAccount(input: {
	email: string
	name: string
	role?: Role
}): Promise<CreatedAccount | { error: string }> {
	const password = temporaryPassword()
	try {
		const created = await adminCreation.run(true, () =>
			auth.api.signUpEmail({
				body: { email: input.email.trim(), password, name: input.name.trim() },
			}),
		)
		const id = created?.user?.id
		if (!id) return { error: 'Account not created' }

		if (input.role === 'admin') await AccountService.setRole(id, 'admin')
		await AccountService.setMustChangePassword(id, true)

		const account = await AccountService.get(id)
		return account ? { account, temporaryPassword: password } : { error: 'Account not created' }
	} catch (error) {
		return { error: reason(error) }
	}
}

/**
 * Replaces a password without knowing the old one — the point of a reset. Goes
 * through the internal adapter, since the public route requires the current
 * password by design.
 */
export async function resetPassword(userId: string): Promise<string | null> {
	const account = await AccountService.get(userId)
	if (!account) return null

	const password = temporaryPassword()
	const context = await auth.$context
	await context.internalAdapter.updatePassword(userId, await context.password.hash(password))
	await AccountService.setMustChangePassword(userId, true)
	return password
}
