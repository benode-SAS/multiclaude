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

/**
 * Autour du vert et de l'orange de la marque : assez distinctes pour se
 * reconnaître d'un coup d'œil, assez proches pour ne pas jurer entre elles.
 * Ces couleurs servent aussi de fond aux sélections partagées, d'où un texte
 * sombre sur fond clair dans les deux thèmes.
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
	if (author === 'claude') return '✳'
	return author.slice(0, 2).toUpperCase()
}

export const isImage = (mime: string) => mime.startsWith('image/')
