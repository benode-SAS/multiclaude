import { useEffect, useState } from 'react'

const DOCK_KEY = 'multiclaude:dock-width'
export const DOCK_MIN = 320
export const DOCK_DEFAULT = 480

export function useMediaQuery(query: string) {
	const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

	useEffect(() => {
		const media = window.matchMedia(query)
		const update = () => setMatches(media.matches)
		update()
		media.addEventListener('change', update)
		return () => media.removeEventListener('change', update)
	}, [query])

	return matches
}

/** Tailwind's `md`: below it the side panels become overlays. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')

export function useDockWidth() {
	const [width, setWidth] = useState(() => {
		const stored = Number(localStorage.getItem(DOCK_KEY))
		return Number.isFinite(stored) && stored >= DOCK_MIN ? stored : DOCK_DEFAULT
	})

	const persist = (next: number) => {
		setWidth(next)
		localStorage.setItem(DOCK_KEY, String(Math.round(next)))
	}

	// A window shrunk below the stored width would squeeze the chat to nothing.
	useEffect(() => {
		const clamp = () => {
			const max = window.innerWidth * 0.75
			setWidth((current) => (current > max ? Math.max(DOCK_MIN, max) : current))
		}
		window.addEventListener('resize', clamp)
		return () => window.removeEventListener('resize', clamp)
	}, [])

	return [width, persist, () => persist(DOCK_DEFAULT)] as const
}
