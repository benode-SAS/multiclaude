import type { Attachment } from '@multiclaude/shared'
import { api } from '../lib/api.ts'
import { formatBytes, isImage } from '../lib/format.ts'
import type { ViewerTarget } from './FileViewer.tsx'
import { Icon } from './Icon.tsx'

export const toTarget = (a: Attachment): ViewerTarget => ({
	relPath: a.relPath,
	filename: a.filename,
	mime: a.mime,
	size: a.size,
})

export function FileChip({
	attachment,
	roomId,
	onOpen,
}: {
	attachment: Attachment
	roomId: string
	onOpen: (target: ViewerTarget) => void
}) {
	if (isImage(attachment.mime)) {
		return (
			<button
				type="button"
				onClick={() => onOpen(toTarget(attachment))}
				className="block overflow-hidden rounded-xl border border-line bg-surface transition hover:border-accent/50"
			>
				<img
					src={api.fileUrl(roomId, attachment.relPath)}
					alt={attachment.filename}
					className="max-h-56 max-w-[280px] object-cover"
					loading="lazy"
				/>
			</button>
		)
	}

	return (
		<span className="inline-flex items-center overflow-hidden rounded-lg border border-line bg-surface text-[13px]">
			<button
				type="button"
				onClick={() => onOpen(toTarget(attachment))}
				className="flex items-center gap-2 px-2.5 py-1.5 transition hover:bg-panel"
			>
				<Icon name="file" size={13} className="shrink-0 text-muted" />
				<span className="max-w-[220px] truncate font-medium">{attachment.filename}</span>
				<span className="text-muted">{formatBytes(attachment.size)}</span>
			</button>
			<a
				href={api.fileUrl(roomId, attachment.relPath, true)}
				title="Download"
				className="border-l border-line px-2 py-1.5 text-muted transition hover:bg-panel hover:text-ink"
			>
				<Icon name="download" size={13} label="Download" />
			</a>
		</span>
	)
}
