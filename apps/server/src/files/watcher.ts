import { watch } from 'node:fs'
import path from 'node:path'
import { isIgnoredDir, mimeOf } from '../lib/paths.ts'
import { listFiles } from './service.ts'

export type FileChange = {
	action: 'created' | 'modified' | 'deleted'
	relPath: string
	size: number
	mime: string
}

type Entry = { size: number; mtime: number; mime: string }

/**
 * Recursive workdir watcher. Raw fs events are only used as a trigger: the
 * agent writes through temp files and renames, so the actual diff comes from
 * rescanning the tree — which also covers anything done via bash.
 */
export function watchWorkdir(workdir: string, onChange: (change: FileChange) => void) {
	let snapshot = new Map<string, Entry>()
	let timer: ReturnType<typeof setTimeout> | null = null
	let scanning = false
	let dirty = false

	const scan = async () => {
		const files = await listFiles(workdir)
		return new Map<string, Entry>(
			files.map((f) => [f.relPath, { size: f.size, mtime: f.modifiedAt, mime: f.mime }]),
		)
	}

	const ready = scan().then((initial) => {
		snapshot = initial
	})

	const diff = async () => {
		if (scanning) {
			dirty = true
			return
		}
		scanning = true
		try {
			await ready
			const next = await scan()
			for (const [relPath, entry] of next) {
				const previous = snapshot.get(relPath)
				if (!previous) {
					onChange({ action: 'created', relPath, size: entry.size, mime: entry.mime })
				} else if (previous.size !== entry.size || previous.mtime !== entry.mtime) {
					onChange({ action: 'modified', relPath, size: entry.size, mime: entry.mime })
				}
			}
			for (const relPath of snapshot.keys()) {
				if (next.has(relPath)) continue
				onChange({ action: 'deleted', relPath, size: 0, mime: mimeOf(relPath) })
			}
			snapshot = next
		} finally {
			scanning = false
			if (dirty) {
				dirty = false
				void diff()
			}
		}
	}

	let watcher: ReturnType<typeof watch> | null = null
	try {
		watcher = watch(workdir, { recursive: true, persistent: false }, (_event, filename) => {
			if (filename && isIgnoredDir(filename.toString().split(path.sep).join('/'))) return
			if (timer) clearTimeout(timer)
			timer = setTimeout(() => {
				timer = null
				void diff()
			}, 250)
		})
		watcher.on('error', () => {})
	} catch {
		// recursive watch unsupported: file changes still surface via tool_use events
	}

	return () => {
		if (timer) clearTimeout(timer)
		watcher?.close()
	}
}
