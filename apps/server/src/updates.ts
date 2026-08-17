import type { VersionInfo } from '@multiclaude/shared'
import pkg from '../../../package.json' with { type: 'json' }
import { config } from './config.ts'

/** The root package.json is the single source of truth for the product version. */
export const VERSION: string = pkg.version

const RELEASES_API = `https://api.github.com/repos/${config.updateRepo}/releases/latest`
const RELEASES_PAGE = `https://github.com/${config.updateRepo}/releases`

/** GitHub tags releases `v1.2.3`; the leading v is presentation, not version. */
const parse = (value: string) => {
	const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value.trim())
	return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

/** True when `candidate` is strictly newer than `current`. */
export function isNewer(candidate: string, current: string) {
	const a = parse(candidate)
	const b = parse(current)
	if (!a || !b) return false
	for (let i = 0; i < 3; i++) {
		if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
	}
	return false
}

let cache: VersionInfo | null = null
let checkedAt = 0
let inFlight: Promise<VersionInfo> | null = null

const local = (): VersionInfo => ({
	current: VERSION,
	latest: null,
	updateAvailable: false,
	releaseUrl: RELEASES_PAGE,
	checkedAt: Date.now(),
})

/**
 * Asks GitHub for the latest release, at most once every few hours and never
 * blocking a request: a self-hosted instance should not depend on github.com
 * being reachable, so every failure falls back to "no idea, current is fine".
 * UPDATE_CHECK=false disables the call entirely.
 */
export async function versionInfo(): Promise<VersionInfo> {
	if (!config.updateCheck) return local()
	if (cache && Date.now() - checkedAt < config.updateCheckIntervalMs) return cache
	if (inFlight) return inFlight

	inFlight = (async () => {
		try {
			const response = await fetch(RELEASES_API, {
				headers: { accept: 'application/vnd.github+json', 'user-agent': 'multiclaude' },
				signal: AbortSignal.timeout(5000),
			})
			if (!response.ok) throw new Error(String(response.status))

			const release = (await response.json()) as { tag_name?: string; html_url?: string }
			const latest = release.tag_name?.replace(/^v/, '') ?? null
			cache = {
				current: VERSION,
				latest,
				updateAvailable: latest ? isNewer(latest, VERSION) : false,
				releaseUrl: release.html_url ?? RELEASES_PAGE,
				checkedAt: Date.now(),
			}
		} catch {
			// Offline, rate-limited, or no release yet: stay quiet rather than
			// showing a warning nobody can act on.
			cache = local()
		}
		checkedAt = Date.now()
		inFlight = null
		return cache
	})()

	return inFlight
}
