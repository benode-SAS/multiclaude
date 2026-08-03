/**
 * Account administration from a shell. Same code path as the admin panel, for
 * the case it exists to cover: nobody can sign in, so nobody can reach the UI.
 */
import { createAccount, resetPassword } from './accounts/provisioning.ts'
import { AccountService } from './accounts/service.ts'
import { runMigrations } from './db/index.ts'

const USAGE = `Usage: bun run cli <command>

  users list                              List the accounts
  users add <email> <name> [--admin]      Create an account, return a temporary password
  users password <email>                  Regenerate the password
  users role <email> <admin|member>       Change the role
  users remove <email>                    Delete the account
`

const [group, command, ...rest] = process.argv.slice(2)
const flags = new Set(rest.filter((argument) => argument.startsWith('--')))
const args = rest.filter((argument) => !argument.startsWith('--'))

const fail = (message: string): never => {
	console.error(message)
	process.exit(1)
}

/** Resolves an account by email, since nobody types an internal id. */
async function byEmail(email: string | undefined) {
	if (!email) fail('Missing email address')
	const account = await AccountService.findByEmail(email!)
	return account ?? fail(`No account for ${email}`)
}

if (group !== 'users' || !command) {
	console.log(USAGE)
	process.exit(command ? 1 : 0)
}

// The CLI may well run before the server ever has, on a fresh database.
runMigrations()

switch (command) {
	case 'list': {
		const accounts = await AccountService.list()
		if (accounts.length === 0) {
			console.log('No account yet. The first one created will be an admin.')
			break
		}
		for (const account of accounts) {
			const flags = [
				account.role === 'admin' ? 'admin' : 'member',
				account.mustChangePassword ? 'password to change' : null,
			].filter(Boolean)
			console.log(`${account.email}\t${account.name}\t${flags.join(', ')}`)
		}
		break
	}

	case 'add': {
		const [email, ...nameParts] = args
		if (!email) fail('Usage: users add <email> <name> [--admin]')
		const name = nameParts.join(' ').trim() || email!.split('@')[0]!

		const created = await createAccount({
			email: email!,
			name,
			role: flags.has('--admin') ? 'admin' : 'member',
		})
		if ('error' in created) fail(created.error)
		if ('account' in created) {
			console.log(`Account created: ${created.account.email} (${created.account.role})`)
			console.log(`Temporary password: ${created.temporaryPassword}`)
			console.log('To be changed at first sign-in.')
		}
		break
	}

	case 'password': {
		const account = await byEmail(args[0])
		const password = await resetPassword(account.id)
		if (!password) fail('Could not reset the password')
		console.log(`Temporary password for ${account.email}: ${password}`)
		console.log('To be changed at first sign-in.')
		break
	}

	case 'role': {
		const account = await byEmail(args[0])
		const role = args[1]
		if (role !== 'admin' && role !== 'member') fail('Expected role: admin or member')

		// Demoting the last admin would leave the settings unreachable.
		if (account.role === 'admin' && role === 'member' && (await AccountService.adminCount()) <= 1) {
			fail('At least one admin must remain')
		}
		await AccountService.setRole(account.id, role as 'admin' | 'member')
		console.log(`${account.email} is now ${role}`)
		break
	}

	case 'remove': {
		const account = await byEmail(args[0])
		if (account.role === 'admin' && (await AccountService.adminCount()) <= 1) {
			fail('At least one admin must remain')
		}
		await AccountService.remove(account.id)
		console.log(`${account.email} deleted`)
		break
	}

	default:
		console.log(USAGE)
		process.exit(1)
}

process.exit(0)
