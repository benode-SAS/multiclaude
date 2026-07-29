export type Theme = 'light' | 'dark' | 'system'

const KEY = 'multiclaude:theme'

export const storedTheme = (): Theme => {
	const value = localStorage.getItem(KEY)
	return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

export function applyTheme(theme: Theme) {
	const resolved = theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme
	document.documentElement.dataset.theme = resolved
	localStorage.setItem(KEY, theme)
	return resolved
}

/** Keeps 'system' in sync when the OS flips while the app is open. */
export function watchSystemTheme(onChange: () => void) {
	const query = window.matchMedia('(prefers-color-scheme: dark)')
	query.addEventListener('change', onChange)
	return () => query.removeEventListener('change', onChange)
}
