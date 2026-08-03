import type {
	AccountSummary,
	AdminConfig,
	AdminSettings,
	Attachment,
	AuthState,
	CreatedAccount,
	FileEntry,
	Role,
	Room,
} from '@multiclaude/shared'

export type SearchHit = {
	roomId: string
	roomTitle: string
	messageId: string
	author: string
	excerpt: string
	createdAt: number
}

const base = '/api'

async function json<T>(input: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${base}${input}`, {
		...init,
		headers:
			init?.body instanceof FormData
				? init.headers
				: { 'content-type': 'application/json', ...init?.headers },
	})
	if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
	return res.json() as Promise<T>
}

export const api = {
	auth: () => json<AuthState>('/auth'),
	startLogin: () => json<AuthState>('/auth/login', { method: 'POST' }),
	submitCode: (code: string) =>
		json<AuthState>('/auth/code', { method: 'POST', body: JSON.stringify({ code }) }),
	cancelLogin: () => json<AuthState>('/auth/cancel', { method: 'POST' }),
	logout: () => json<AuthState>('/auth/logout', { method: 'POST' }),

	accounts: () => json<AccountSummary[]>('/accounts'),
	createAccount: (input: { email: string; name: string; role: Role }) =>
		json<CreatedAccount>('/accounts', { method: 'POST', body: JSON.stringify(input) }),
	resetAccountPassword: (id: string) =>
		json<{ temporaryPassword: string }>(`/accounts/${id}/password`, { method: 'POST' }),
	changePassword: (currentPassword: string, newPassword: string) =>
		json<{ ok: boolean }>('/account/password', {
			method: 'POST',
			body: JSON.stringify({ currentPassword, newPassword }),
		}),
	setAccountRole: (id: string, role: Role) =>
		json<AccountSummary>(`/accounts/${id}/role`, {
			method: 'PATCH',
			body: JSON.stringify({ role }),
		}),
	removeAccount: (id: string) => json<{ ok: boolean }>(`/accounts/${id}`, { method: 'DELETE' }),
	adminConfig: () => json<AdminConfig>('/admin/config'),
	saveAdminConfig: (patch: Partial<AdminSettings>) =>
		json<AdminSettings>('/admin/config', { method: 'PATCH', body: JSON.stringify(patch) }),

	rooms: () => json<Room[]>('/rooms'),
	search: (q: string, roomId?: string) =>
		json<SearchHit[]>(
			`/rooms/search/all?q=${encodeURIComponent(q)}${roomId ? `&roomId=${roomId}` : ''}`,
		),
	exportUrl: (roomId: string) => `${base}/rooms/${roomId}/export`,
	createRoom: (input: { title?: string; repoUrl?: string; branch?: string } = {}) =>
		json<Room>('/rooms', { method: 'POST', body: JSON.stringify(input) }),
	forkRoom: (id: string) => json<Room>(`/rooms/${id}/fork`, { method: 'POST', body: '{}' }),
	renameRoom: (id: string, title: string) =>
		json<Room>(`/rooms/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
	deleteRoom: (id: string) => json<{ ok: boolean }>(`/rooms/${id}`, { method: 'DELETE' }),
	files: (id: string) => json<FileEntry[]>(`/rooms/${id}/files`),
	upload: (id: string, file: File) => {
		const form = new FormData()
		form.append('file', file)
		return json<Attachment>(`/rooms/${id}/upload`, { method: 'POST', body: form })
	},
	/** Path-addressed URL, so a rendered page can resolve relative assets. */
	rawUrl: (roomId: string, relPath: string) =>
		`${base}/rooms/${roomId}/raw/${relPath.split('/').map(encodeURIComponent).join('/')}`,
	fileUrl: (roomId: string, relPath: string, download = false) =>
		`${base}/rooms/${roomId}/files/content?path=${encodeURIComponent(relPath)}${download ? '&download=1' : ''}`,
}
