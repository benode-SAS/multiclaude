import { Elysia, status, t } from 'elysia'
import { disposeRuntime, getRuntime } from '../agent/runtime.ts'
import { hub } from '../ws/hub.ts'
import { RoomService } from './service.ts'

export const roomRoutes = new Elysia({ prefix: '/rooms' })
	.get('/', () => RoomService.list())

	.post(
		'/',
		async ({ body }) => {
			const room = await RoomService.create(body?.title)
			await getRuntime(room.id)
			return room
		},
		{ body: t.Optional(t.Object({ title: t.Optional(t.String()) })) },
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
