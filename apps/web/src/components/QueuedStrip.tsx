import type { QueuedItem } from '@multiclaude/shared'
import { useState } from 'react'
import { Avatar } from './Avatar.tsx'
import { Icon } from './Icon.tsx'

/**
 * Pinned above the input rather than left in the thread: these messages have
 * not been sent yet, and Claude's stream buried them instantly.
 */
export function QueuedStrip({
	items,
	self,
	onEdit,
	onCancel,
}: {
	items: QueuedItem[]
	self: string
	onEdit: (messageId: string, content: string) => void
	onCancel: (messageId: string) => void
}) {
	const [editingId, setEditingId] = useState<string | null>(null)
	const [draft, setDraft] = useState('')

	if (items.length === 0) return null

	const commit = (id: string) => {
		const content = draft.trim()
		if (content) onEdit(id, content)
		setEditingId(null)
	}

	return (
		<div className="mb-2 overflow-hidden rounded-xl border border-accent/30 bg-accent-soft/40">
			<p className="border-b border-accent/20 px-3 py-1.5 text-[11px] font-medium text-accent-ink">
				{items.length} queued message{items.length > 1 ? 's' : ''} — going out as soon as Claude is
				done
			</p>

			{items.map((item) => (
				<div key={item.id} className="flex items-start gap-2 px-3 py-2">
					<Avatar author={item.pseudo} size={20} />

					{editingId === item.id ? (
						<div className="flex min-w-0 flex-1 flex-col gap-1.5">
							<textarea
								autoFocus
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault()
										commit(item.id)
									}
									if (e.key === 'Escape') setEditingId(null)
								}}
								rows={2}
								className="w-full resize-none rounded-lg border border-accent/50 bg-surface px-2 py-1.5 text-[13px] outline-none"
							/>
							<div className="flex gap-2 text-[12px]">
								<button
									type="button"
									onClick={() => commit(item.id)}
									className="rounded bg-accent px-2 py-0.5 text-on-accent"
								>
									Save
								</button>
								<button
									type="button"
									onClick={() => setEditingId(null)}
									className="text-muted hover:text-ink"
								>
									Cancel
								</button>
							</div>
						</div>
					) : (
						<>
							<p className="min-w-0 flex-1 text-[13px] break-anywhere whitespace-pre-wrap">
								{item.content}
							</p>
							{item.pseudo === self && (
								<span className="flex shrink-0 gap-1">
									<button
										type="button"
										title="Edit before sending"
										onClick={() => {
											setEditingId(item.id)
											setDraft(item.content)
										}}
										className="text-[12px] text-muted hover:text-ink"
									>
										<Icon name="pencil" size={13} label="Edit" />
									</button>
									<button
										type="button"
										title="Remove from the queue"
										onClick={() => onCancel(item.id)}
										className="text-[12px] text-muted hover:text-danger"
									>
										<Icon name="close" size={13} label="Cancel" />
									</button>
								</span>
							)}
						</>
					)}
				</div>
			))}
		</div>
	)
}
