import { Elysia, status, t } from 'elysia'
import { disposeRuntime, getRuntime } from '../agent/runtime.ts'
import { hub } from '../ws/hub.ts'
import { cloneInto, isCloneUrl } from './clone.ts'
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

	.delete('/:id', async ({ params }) => {
		disposeRuntime(params.id)
		const removed = await RoomService.remove(params.id)
		return removed ? { ok: true } : status(404, 'Not Found')
	})
