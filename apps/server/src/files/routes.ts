import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { Elysia, status, t } from 'elysia'
import { config } from '../config.ts'
import { mimeOf, safeJoin } from '../lib/paths.ts'
import { RoomService } from '../rooms/service.ts'
import { hub } from '../ws/hub.ts'
import { listFiles, readFileMeta } from './service.ts'

const sanitize = (name: string) =>
	path
		.basename(name)
		.replace(/[^\w.\- ]+/g, '_')
		.slice(0, 120) || 'fichier'

export const fileRoutes = new Elysia({ prefix: '/rooms/:id' })
	.get('/files', async ({ params }) => {
		const room = await RoomService.get(params.id)
		if (!room) return status(404, 'Not Found')
		return listFiles(room.workdir)
	})

	.get(
		'/files/content',
		async ({ params, query, set }) => {
			const room = await RoomService.get(params.id)
			if (!room) return status(404, 'Not Found')

			let meta: Awaited<ReturnType<typeof readFileMeta>>
			try {
				meta = await readFileMeta(room.workdir, query.path)
			} catch {
				return status(400, 'Bad Path')
			}
			if (!meta) return status(404, 'Not Found')

			set.headers['content-type'] = meta.mime
			set.headers['cache-control'] = 'no-cache'
			set.headers['x-content-type-options'] = 'nosniff'
			// Agent-authored markup must stay inert even when opened directly in a tab:
			// `sandbox` puts it in an opaque origin, so no script and no access to the app.
			if (meta.mime === 'text/html' || meta.mime === 'image/svg+xml') {
				set.headers['content-security-policy'] = 'sandbox'
			}
			if (query.download === '1') {
				const name = path.basename(query.path)
				set.headers['content-disposition'] = `attachment; filename="${sanitize(name)}"`
			}
			return Bun.file(meta.abs)
		},
		{ query: t.Object({ path: t.String(), download: t.Optional(t.String()) }) },
	)

	.post(
		'/upload',
		async ({ params, body }) => {
			const room = await RoomService.get(params.id)
			if (!room) return status(404, 'Not Found')
			if (body.file.size > config.maxUploadBytes) return status(413, 'File Too Large')

			const filename = sanitize(body.file.name)
			const relPath = `uploads/${Date.now().toString(36)}-${filename}`
			const abs = safeJoin(room.workdir, relPath)
			await mkdir(path.dirname(abs), { recursive: true })
			await Bun.write(abs, body.file)

			const attachment = await RoomService.upsertAttachment({
				roomId: room.id,
				messageId: null,
				source: 'user',
				filename,
				relPath,
				mime: body.file.type || mimeOf(abs),
				size: body.file.size,
			})
			hub.broadcast(room.id, { type: 'attachment', attachment })
			return attachment
		},
		{ body: t.Object({ file: t.File() }) },
	)
