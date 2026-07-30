import { Elysia, status, t } from 'elysia'
import { disposeRuntime, getRuntime } from '../agent/runtime.ts'
import { hub } from '../ws/hub.ts'
import { cloneInto, isCloneUrl } from './clone.ts'
import { exportRoom } from './export.ts'
import { searchMessages } from './search.ts'
import { RoomService } from './service.ts'

export const roomRoutes = new Elysia({ prefix: '/rooms' })
	.get('/', () => RoomService.list())

	.post(
		'/',
		async ({ body }) => {
			const repoUrl = body?.repoUrl?.trim()
			if (repoUrl && !isCloneUrl(repoUrl)) return status(400, 'URL de dépôt non reconnue')

			const room = await RoomService.create(body?.title)

			// Cloné avant de rendre la main : un turn lancé sur un dossier à
			// moitié cloné donnerait des résultats incohérents.
			if (repoUrl) {
				const result = await cloneInto(room.workdir, repoUrl, body?.branch)
				if (!result.ok) {
					await RoomService.remove(room.id)
					return status(422, result.error)
				}
				await RoomService.addMessage({
					roomId: room.id,
					author: 'system',
					role: 'system',
					content: `📦 Dépôt cloné : ${repoUrl}${
						result.head
							? `

HEAD : ${result.head}`
							: ''
					}`,
				})
			}

			await getRuntime(room.id)
			return room
		},
		{
			body: t.Optional(
				t.Object({
					title: t.Optional(t.String()),
					repoUrl: t.Optional(t.String()),
					branch: t.Optional(t.String()),
				}),
			),
		},
	)

	.get('/search/all', ({ query }) => searchMessages(query.q ?? '', query.roomId), {
		query: t.Object({ q: t.Optional(t.String()), roomId: t.Optional(t.String()) }),
	})

	.get('/:id', async ({ params }) => (await RoomService.get(params.id)) ?? status(404, 'Not Found'))

	.patch(
		'/:id',
		async ({ params, body }) => {
			const room = await RoomService.rename(params.id, body.title)
			if (!room) return status(404, 'Not Found')
			hub.broadcast(room.id, { type: 'room_updated', room })
			return room
		},
		{ body: t.Object({ title: t.String() }) },
	)

	.get('/:id/export', async ({ params, set }) => {
		const result = await exportRoom(params.id)
		if (!result) return status(404, 'Not Found')
		const name = result.room.title.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'conversation'
		set.headers['content-type'] = 'text/markdown; charset=utf-8'
		set.headers['content-disposition'] = `attachment; filename="${name}.md"`
		return result.markdown
	})

	.delete('/:id', async ({ params }) => {
		disposeRuntime(params.id)
		const removed = await RoomService.remove(params.id)
		return removed ? { ok: true } : status(404, 'Not Found')
	})
