import type { SessionInfo } from '@multiclaude/shared'
import { createAuthClient } from 'better-auth/client'

/** Même origine que l'app : le proxy de dev comme la prod servent /api/auth. */
export const authClient = createAuthClient({ basePath: '/api/auth' })

const readError = (error: unknown) => {
	if (error && typeof error === 'object' && 'message' in error) return String(error.message)
	return 'Échec de la connexion'
}

export async function fetchSession(): Promise<SessionInfo> {
	const res = await fetch('/api/session')
	if (!res.ok) throw new Error(`${res.status}`)
	return res.json() as Promise<SessionInfo>
}

export async function signIn(email: string, password: string) {
	const { error } = await authClient.signIn.email({ email, password })
	if (error) throw new Error(readError(error))
}

export async function signUp(email: string, password: string, name: string) {
	const { error } = await authClient.signUp.email({ email, password, name })
	if (error) throw new Error(readError(error))
}

export async function signOut() {
	await authClient.signOut()
}
