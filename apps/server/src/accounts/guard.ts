import type { AccountSummary } from '@multiclaude/shared'
import { status } from 'elysia'
import { auth } from './auth.ts'
import { AccountService } from './service.ts'

/** Résout la session depuis les cookies de la requête, ou null. */
export async function currentUser(request: Request): Promise<AccountSummary | null> {
	try {
		const session = await auth.api.getSession({ headers: request.headers })
		if (!session?.user?.id) return null
		return AccountService.get(session.user.id)
	} catch {
		return null
	}
}

/** Renvoie une réponse d'erreur si l'appelant n'est pas connecté, sinon null. */
export async function requireUser(request: Request) {
	const user = await currentUser(request)
	return user ? null : status(401, 'Connexion requise')
}

export async function requireAdmin(request: Request) {
	const user = await currentUser(request)
	if (!user) return status(401, 'Connexion requise')
	if (user.role !== 'admin') return status(403, 'Réservé aux administrateurs')
	return null
}
