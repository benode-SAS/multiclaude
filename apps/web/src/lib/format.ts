export function formatBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatTime(ts: number) {
	return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function formatDay(ts: number) {
	return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * Built around the brand green and orange: distinct enough to tell people apart
 * at a glance, close enough not to clash. These colours also back the shared
 * selections, hence dark text on a light field in both themes.
 */
const PALETTE = [
	{ bg: '#dfeae2', fg: '#1e4d33' },
	{ bg: '#fdeccf', fg: '#a2560a' },
	{ bg: '#dee9ec', fg: '#1f5766' },
	{ bg: '#e9e7d9', fg: '#5d5a3c' },
	{ bg: '#f3e4da', fg: '#8a4b25' },
	{ bg: '#e4ecdd', fg: '#456b2f' },
]

export function authorColor(author: string) {
	if (author === 'claude') return { bg: '#fdeccf', fg: '#b8500c' }
	if (author === 'system') return { bg: '#e7ebe8', fg: '#5f6d65' }
	let hash = 0
	for (let i = 0; i < author.length; i++) hash = (hash * 31 + author.charCodeAt(i)) >>> 0
	return PALETTE[hash % PALETTE.length]!
}

export function initials(author: string) {
	if (author === 'claude') return 'AI'
	return author.slice(0, 2).toUpperCase()
}

export const isImage = (mime: string) => mime.startsWith('image/')
