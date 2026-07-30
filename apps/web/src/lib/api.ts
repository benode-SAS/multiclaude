import type { Attachment, AuthState, FileEntry, Room } from '@multiclaude/shared'

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

	rooms: () => json<Room[]>('/rooms'),
	createRoom: (title?: string) =>
		json<Room>('/rooms', { method: 'POST', body: JSON.stringify({ title }) }),
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
