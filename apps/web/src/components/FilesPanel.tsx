import type { FileEntry } from '@multiclaude/shared'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { formatBytes, formatTime, isImage } from '../lib/format.ts'
import type { ViewerTarget } from './FileViewer.tsx'

export function FilesPanel({
	roomId,
	revision,
	onOpen,
	onClose,
}: {
	roomId: string
	revision: number
	onOpen: (target: ViewerTarget) => void
	onClose: () => void
}) {
	const [files, setFiles] = useState<FileEntry[]>([])

	const load = useCallback(() => {
		api
			.files(roomId)
			.then(setFiles)
			.catch(() => setFiles([]))
	}, [roomId])

	useEffect(load, [load, revision])

	return (
		<div className="flex h-full min-h-0 flex-col bg-panel/60">
			<div className="flex items-center gap-2 border-b border-line px-4 py-3">
				<span className="text-[13px] font-semibold">Workdir</span>
				<span className="text-[12px] text-muted">{files.length}</span>
				<button
					type="button"
					onClick={load}
					title="Rafraîchir"
					className="ml-auto text-[12px] text-muted hover:text-ink"
				>
					↻
				</button>
				<button
					type="button"
					onClick={onClose}
					title="Fermer"
					className="text-[14px] text-muted hover:text-ink"
				>
					✕
				</button>
			</div>

			<div className="flex-1 overflow-y-auto p-2">
				{files.length === 0 && (
					<p className="px-2 py-4 text-[13px] text-muted">Aucun fichier pour l'instant.</p>
				)}
				{files.map((file) => (
					<button
						key={file.relPath}
						type="button"
						onClick={() =>
							onOpen({
								relPath: file.relPath,
								filename: file.name,
								mime: file.mime,
								size: file.size,
							})
						}
						className="mb-0.5 block w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-surface"
					>
						<div className="truncate text-[13px] font-medium" title={file.relPath}>
							{isImage(file.mime) ? '🖼️' : '📄'} {file.relPath}
						</div>
						<div className="text-[11px] text-muted">
							{formatBytes(file.size)} · {formatTime(file.modifiedAt)}
						</div>
					</button>
				))}
			</div>
		</div>
	)
}
