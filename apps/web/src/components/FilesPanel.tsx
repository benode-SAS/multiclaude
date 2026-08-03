import type { FileEntry } from '@multiclaude/shared'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.ts'
import { buildTree } from '../lib/file-tree.ts'
import { formatBytes, formatTime, isImage } from '../lib/format.ts'
import { FileTree } from './FileTree.tsx'
import type { ViewerTarget } from './FileViewer.tsx'
import { Icon, type IconName } from './Icon.tsx'

type View = 'list' | 'tree'
const VIEW_KEY = 'multiclaude:files-view'

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
	// The tree by default: it places a file inside the project, where the list
	// only answers "what just moved".
	const [view, setView] = useState<View>(
		() => (localStorage.getItem(VIEW_KEY) as View | null) ?? 'tree',
	)

	const tree = useMemo(() => buildTree(files), [files])

	const switchTo = (next: View) => {
		setView(next)
		localStorage.setItem(VIEW_KEY, next)
	}

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

				<div className="ml-auto flex overflow-hidden rounded-lg border border-line">
					{(
						[
							['tree', 'folder-tree', 'Directory tree'],
							['list', 'list', 'List, newest first'],
						] as Array<[View, IconName, string]>
					).map(([id, icon, label]) => (
						<button
							key={id}
							type="button"
							onClick={() => switchTo(id)}
							title={label}
							aria-pressed={view === id}
							className={clsx(
								'flex size-8 items-center justify-center transition',
								view === id ? 'bg-accent text-on-accent' : 'bg-surface text-muted hover:text-ink',
							)}
						>
							<Icon name={icon} size={15} label={label} />
						</button>
					))}
				</div>

				<button
					type="button"
					onClick={load}
					title="Refresh"
					className="flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-ink"
				>
					<Icon name="refresh" size={15} label="Refresh" />
				</button>
				<button
					type="button"
					onClick={onClose}
					title="Close"
					className="flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-ink"
				>
					<Icon name="close" size={16} label="Close" />
				</button>
			</div>

			<div className="flex-1 overflow-y-auto p-2">
				{files.length === 0 && <p className="px-2 py-4 text-[13px] text-muted">No files yet.</p>}
				{view === 'tree' ? (
					<FileTree nodes={tree} onOpen={onOpen} />
				) : (
					files.map((file) => (
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
								<Icon
									name={isImage(file.mime) ? 'image' : 'file'}
									size={13}
									className="mr-1.5 inline shrink-0 text-muted"
								/>
								{file.relPath}
							</div>
							<div className="text-[11px] text-muted">
								{formatBytes(file.size)} · {formatTime(file.modifiedAt)}
							</div>
						</button>
					))
				)}
			</div>
		</div>
	)
}
