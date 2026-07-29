const KEY = 'multiclaude:sound'

export const soundEnabled = () => localStorage.getItem(KEY) !== 'off'
export const setSoundEnabled = (on: boolean) => localStorage.setItem(KEY, on ? 'on' : 'off')

let context: AudioContext | null = null

/**
 * Browsers only allow audio once the page has been interacted with, so the
 * context is created on the first gesture and reused afterwards.
 */
export function primeAudio() {
	if (context) {
		if (context.state === 'suspended') void context.resume()
		return
	}
	const Ctor =
		window.AudioContext ??
		(window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
	if (!Ctor) return
	context = new Ctor()
}

/** Two-tone chime — synthesised, so there is no asset to ship or preload. */
export function playPermissionChime() {
	if (!soundEnabled()) return
	primeAudio()
	const ctx = context
	if (ctx?.state !== 'running') return

	const now = ctx.currentTime
	for (const [index, frequency] of [880, 1320].entries()) {
		const oscillator = ctx.createOscillator()
		const gain = ctx.createGain()
		const start = now + index * 0.16

		oscillator.type = 'sine'
		oscillator.frequency.setValueAtTime(frequency, start)
		gain.gain.setValueAtTime(0.0001, start)
		gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02)
		gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32)

		oscillator.connect(gain).connect(ctx.destination)
		oscillator.start(start)
		oscillator.stop(start + 0.34)
	}
}

/** Flashes the tab title until the window regains focus. */
export function flashTitle(message: string) {
	if (!document.hidden && document.hasFocus()) return
	const original = document.title
	let on = false
	const timer = setInterval(() => {
		on = !on
		document.title = on ? message : original
	}, 900)
	const stop = () => {
		clearInterval(timer)
		document.title = original
		window.removeEventListener('focus', stop)
	}
	window.addEventListener('focus', stop)
}
