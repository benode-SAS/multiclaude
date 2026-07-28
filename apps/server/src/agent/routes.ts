import { Elysia, t } from 'elysia'
import { getRuntime } from './runtime.ts'

/** Called by the PreToolUse hook of each room's claude process. */
export const internalRoutes = new Elysia({ prefix: '/internal' }).post(
	'/permission',
	async ({ body }) => {
		const runtime = await getRuntime(body.roomId)
		if (!runtime) return { allow: true }
		return runtime.requestPermission(body.tool, (body.input ?? {}) as Record<string, unknown>)
	},
	{
		body: t.Object({
			roomId: t.String(),
			tool: t.String(),
			input: t.Optional(t.Unknown()),
		}),
	},
)
