export function formatBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} o`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
	return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

export function formatTime(ts: number) {
	return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDay(ts: number) {
	return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const PALETTE = [
	{ bg: '#e8ecf7', fg: '#33518c' },
	{ bg: '#e6f2ea', fg: '#2f6b48' },
	{ bg: '#f6e9f2', fg: '#7c3f68' },
	{ bg: '#fdf0dd', fg: '#8a5a1c' },
	{ bg: '#e5f1f4', fg: '#2c6470' },
	{ bg: '#f0ecfa', fg: '#5a479b' },
]

export function authorColor(author: string) {
	if (author === 'claude') return { bg: '#f4e4de', fg: '#c96442' }
	if (author === 'system') return { bg: '#eeece6', fg: '#6f6b62' }
	let hash = 0
	for (let i = 0; i < author.length; i++) hash = (hash * 31 + author.charCodeAt(i)) >>> 0
	return PALETTE[hash % PALETTE.length]!
}

export function initials(author: string) {
	if (author === 'claude') return '✳'
	return author.slice(0, 2).toUpperCase()
}

export const isImage = (mime: string) => mime.startsWith('image/')
