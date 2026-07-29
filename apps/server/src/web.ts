import path from 'node:path'
import { Elysia, status } from 'elysia'
import { config } from './config.ts'
import { safeJoin } from './lib/paths.ts'

const HAS_EXTENSION = /\.[a-z0-9]+$/i
const indexHtml = () => Bun.file(path.join(config.webDist, 'index.html'))

/**
 * Serves the built front (`bun run build`) so a deployment needs a single port.
 *
 * Deliberately not @elysiajs/static: that plugin is async, so `.use()` defers
 * its routes and the SPA fallback registered after it wins — assets 404 and the
 * page loads blank. One handler has no ordering to get wrong.
 */
export const webRoutes = new Elysia().get('*', async ({ path: requested, set }) => {
	const relative = requested.replace(/^\/+/, '') || 'index.html'

	let target: string | null = null
	try {
		target = safeJoin(config.webDist, relative)
	} catch {
		return status(400, 'Bad Path')
	}

	const file = Bun.file(target)
	if (await file.exists()) {
		// Vite fingerprints asset filenames, so they can be cached hard; index.html
		// must not be, or a deploy keeps serving the previous bundle.
		set.headers['cache-control'] = requested.startsWith('/assets/')
			? 'public, max-age=31536000, immutable'
			: 'no-cache'
		return file
	}

	// Unknown path: the app is a single page, but a missing asset is a real 404.
	if (HAS_EXTENSION.test(requested)) return status(404, 'Not Found')
	set.headers['cache-control'] = 'no-cache'
	return indexHtml()
})
