import path from 'node:path'
import { staticPlugin } from '@elysiajs/static'
import { Elysia, status } from 'elysia'
import { config } from './config.ts'

const HAS_EXTENSION = /\.[a-z0-9]+$/i

/**
 * Serves the built front (`bun run build`) so a deployment needs a single port.
 * The fallback only answers extension-less paths: a missing asset must 404
 * rather than silently receive index.html.
 */
export const webRoutes = new Elysia()
	.use(staticPlugin({ assets: config.webDist, prefix: '/', indexHTML: true }))
	.get('*', ({ path: requested }) =>
		HAS_EXTENSION.test(requested)
			? status(404, 'Not Found')
			: Bun.file(path.join(config.webDist, 'index.html')),
	)
