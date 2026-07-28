import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { FileEntry } from '@multiclaude/shared'
import { isIgnored, mimeOf, safeJoin, toRelPath } from '../lib/paths.ts'

export async function listFiles(workdir: string): Promise<FileEntry[]> {
	const out: FileEntry[] = []

	async function walk(dir: string) {
		const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
		for (const entry of entries) {
			const abs = path.join(dir, entry.name)
			const rel = toRelPath(workdir, abs)
			if (isIgnored(rel)) continue
			if (entry.isDirectory()) {
				await walk(abs)
				continue
			}
			if (!entry.isFile()) continue
			const info = await stat(abs).catch(() => null)
			if (!info) continue
			out.push({
				relPath: rel,
				name: entry.name,
				size: info.size,
				mime: mimeOf(abs),
				modifiedAt: info.mtimeMs,
			})
		}
	}

	await walk(workdir)
	return out.sort((a, b) => b.modifiedAt - a.modifiedAt)
}

export async function readFileMeta(workdir: string, relPath: string) {
	const abs = safeJoin(workdir, relPath)
	const info = await stat(abs).catch(() => null)
	if (!info?.isFile()) return null
	return { abs, size: info.size, mime: mimeOf(abs), modifiedAt: info.mtimeMs }
}
