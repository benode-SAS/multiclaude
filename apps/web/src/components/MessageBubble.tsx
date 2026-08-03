import type { Attachment, Message } from '@multiclaude/shared'
import clsx from 'clsx'
import { useState } from 'react'
import { authorColor, formatTime } from '../lib/format.ts'
import { Avatar } from './Avatar.tsx'
import { FileChip } from './FileChip.tsx'
import type { ViewerTarget } from './FileViewer.tsx'
import { Icon } from './Icon.tsx'
import { Markdown } from './Markdown.tsx'

export function MessageBubble({
	message,
	attachments,
	roomId,
	canEdit,
	onEdit,
	onOpen,
}: {
	message: Message
	attachments: Attachment[]
	roomId: string
	canEdit?: boolean
	onEdit?: (messageId: string, content: string) => void
	onOpen: (target: ViewerTarget) => void
}) {
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(message.content)

	const commit = () => {
		const next = draft.trim()
		if (next && next !== message.content) onEdit?.(message.id, next)
		setEditing(false)
	}
	const isClaude = message.role === 'assistant'
	const isSystem = message.role === 'system'
	const color = authorColor(message.author)

	return (
		<div className="group/msg flex gap-3" data-message-id={message.id}>
			<Avatar author={message.author} />
			<div className="min-w-0 flex-1">
				<div className="mb-1 flex items-baseline gap-2">
					<span className="text-[13px] font-semibold" style={{ color: color.fg }}>
						{isClaude ? 'Claude' : message.author}
					</span>
					<span className="text-[11px] text-muted">{formatTime(message.createdAt)}</span>
					{message.editedAt && (
						<span className="text-[11px] text-muted" title="Message corrigé après envoi">
							modifié
						</span>
					)}
					{canEdit && !editing && (
						<button
							type="button"
							onClick={() => {
								setDraft(message.content)
								setEditing(true)
							}}
							title="Modifier"
							className="rounded p-0.5 text-muted opacity-0 transition group-hover/msg:opacity-100 hover:bg-panel hover:text-ink"
						>
							<Icon name="pencil" size={13} label="Modifier" />
						</button>
					)}
				</div>

				<div
					// Anchor for shared selections: the text container alone, so the
					// offsets do not shift with the header.
					data-selection-scope="message"
					data-selection-key={message.id}
					className={clsx(
						'max-w-[min(760px,100%)] rounded-2xl px-4 py-3',
						isClaude && 'bg-surface border border-line',
						isSystem && 'bg-panel border border-line text-muted text-[13px]',
						// Une bulle humaine se distingue par une teinte verte, pas par un
						// alignement : à plusieurs, tout le monde parle du même côté.
						!isClaude && !isSystem && 'bg-brand-soft',
					)}
				>
					{editing ? (
						<div className="flex flex-col gap-2">
							<textarea
								autoFocus
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault()
										commit()
									}
									if (e.key === 'Escape') setEditing(false)
								}}
								rows={3}
								className="w-full resize-none rounded-lg border border-accent/50 bg-surface px-2 py-1.5 text-[14px] outline-none"
							/>
							<div className="flex items-center gap-2 text-[12px]">
								<button
									type="button"
									onClick={commit}
									className="rounded bg-accent px-2 py-0.5 text-on-accent"
								>
									Enregistrer
								</button>
								<button
									type="button"
									onClick={() => setEditing(false)}
									className="text-muted hover:text-ink"
								>
									Annuler
								</button>
								{/* Claude's session keeps the original, and saying so avoids the
								    belief that an edit changes what it understood. */}
								<span className="text-muted">Claude garde la version déjà reçue</span>
							</div>
						</div>
					) : isClaude ? (
						<Markdown>{message.content}</Markdown>
					) : (
						<p className="break-anywhere text-[15px] leading-relaxed whitespace-pre-wrap">
							{message.content}
						</p>
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
				<div className="mb-1 text-[13px] font-semibold text-accent-ink">Claude</div>
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
