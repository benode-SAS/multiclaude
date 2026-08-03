/**
 * Account administration from a shell. Same code path as the admin panel, for
 * the case it exists to cover: nobody can sign in, so nobody can reach the UI.
 */
import { createAccount, resetPassword } from './accounts/provisioning.ts'
import { AccountService } from './accounts/service.ts'
import { runMigrations } from './db/index.ts'

const USAGE = `Usage: bun run cli <commande>

  users list                              Liste les comptes
  users add <email> <nom> [--admin]       Crée un compte, renvoie un mot de passe temporaire
  users password <email>                  Régénère le mot de passe
  users role <email> <admin|member>       Change le rôle
  users remove <email>                    Supprime le compte
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
	if (!email) fail('Adresse e-mail manquante')
	const account = await AccountService.findByEmail(email!)
	return account ?? fail(`Aucun compte pour ${email}`)
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
			console.log('Aucun compte. Le premier créé sera administrateur.')
			break
		}
		for (const account of accounts) {
			const flags = [
				account.role === 'admin' ? 'admin' : 'membre',
				account.mustChangePassword ? 'mot de passe à changer' : null,
			].filter(Boolean)
			console.log(`${account.email}\t${account.name}\t${flags.join(', ')}`)
		}
		break
	}

	case 'add': {
		const [email, ...nameParts] = args
		if (!email) fail('Usage: users add <email> <nom> [--admin]')
		const name = nameParts.join(' ').trim() || email!.split('@')[0]!

		const created = await createAccount({
			email: email!,
			name,
			role: flags.has('--admin') ? 'admin' : 'member',
		})
		if ('error' in created) fail(created.error)
		if ('account' in created) {
			console.log(`Compte créé : ${created.account.email} (${created.account.role})`)
			console.log(`Mot de passe temporaire : ${created.temporaryPassword}`)
			console.log('À changer à la première connexion.')
		}
		break
	}

	case 'password': {
		const account = await byEmail(args[0])
		const password = await resetPassword(account.id)
		if (!password) fail('Réinitialisation impossible')
		console.log(`Mot de passe temporaire de ${account.email} : ${password}`)
		console.log('À changer à la première connexion.')
		break
	}

	case 'role': {
		const account = await byEmail(args[0])
		const role = args[1]
		if (role !== 'admin' && role !== 'member') fail('Rôle attendu : admin ou member')

		// Demoting the last admin would leave the settings unreachable.
		if (account.role === 'admin' && role === 'member' && (await AccountService.adminCount()) <= 1) {
			fail('Il doit rester au moins un administrateur')
		}
		await AccountService.setRole(account.id, role as 'admin' | 'member')
		console.log(`${account.email} est désormais ${role}`)
		break
	}

	case 'remove': {
		const account = await byEmail(args[0])
		if (account.role === 'admin' && (await AccountService.adminCount()) <= 1) {
			fail('Il doit rester au moins un administrateur')
		}
		await AccountService.remove(account.id)
		console.log(`${account.email} supprimé`)
		break
	}

	default:
		console.log(USAGE)
		process.exit(1)
}

process.exit(0)
