import type { Attachment, Message } from '@multiclaude/shared'
import clsx from 'clsx'
import { authorColor, formatTime } from '../lib/format.ts'
import { Avatar } from './Avatar.tsx'
import { FileChip } from './FileChip.tsx'
import type { ViewerTarget } from './FileViewer.tsx'
import { Markdown } from './Markdown.tsx'

export function MessageBubble({
	message,
	attachments,
	roomId,
	queued,
	onOpen,
}: {
	message: Message
	attachments: Attachment[]
	roomId: string
	queued?: boolean
	onOpen: (target: ViewerTarget) => void
}) {
	const isClaude = message.role === 'assistant'
	const isSystem = message.role === 'system'
	const color = authorColor(message.author)

	return (
		<div className="flex gap-3">
			<Avatar author={message.author} />
			<div className="min-w-0 flex-1">
				<div className="mb-1 flex items-baseline gap-2">
					<span className="text-[13px] font-semibold" style={{ color: color.fg }}>
						{isClaude ? 'Claude' : message.author}
					</span>
					<span className="text-[11px] text-muted">{formatTime(message.createdAt)}</span>
					{queued && (
						<span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
							en attente
						</span>
					)}
				</div>

				<div
					className={clsx(
						'max-w-[min(760px,100%)] rounded-2xl px-4 py-3',
						isClaude && 'bg-surface border border-line',
						isSystem && 'bg-panel border border-line text-muted text-[13px]',
						!isClaude && !isSystem && 'bg-panel',
					)}
				>
					{isClaude ? (
						<Markdown>{message.content}</Markdown>
					) : (
						<p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
					)}
				</div>

				{attachments.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-2">
						{attachments.map((attachment) => (
							<FileChip
								key={attachment.id}
								attachment={attachment}
								roomId={roomId}
								onOpen={onOpen}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

export function StreamingBubble({ text }: { text: string }) {
	return (
		<div className="flex gap-3">
			<Avatar author="claude" />
			<div className="min-w-0 flex-1">
				<div className="mb-1 text-[13px] font-semibold text-accent">Claude</div>
				<div className="max-w-[min(760px,100%)] rounded-2xl border border-line bg-surface px-4 py-3">
					{text ? (
						<div className="caret">
							<Markdown>{text}</Markdown>
						</div>
					) : (
						<span className="text-[14px] text-muted">Claude réfléchit…</span>
					)}
				</div>
			</div>
		</div>
	)
}
