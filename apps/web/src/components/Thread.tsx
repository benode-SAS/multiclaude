import type { Attachment, Message, PermissionRequest, QueuedItem } from '@multiclaude/shared'
import { useEffect, useMemo, useRef } from 'react'
import { applyScrollRatio, scrollRatio } from '../lib/presence.ts'
import { buildTimeline, groupTimeline } from '../lib/timeline.ts'
import { FileChip } from './FileChip.tsx'
import type { ViewerTarget } from './FileViewer.tsx'
import { MessageBubble, StreamingBubble } from './MessageBubble.tsx'
import { PermissionCard } from './PermissionCard.tsx'
import { ToolCard } from './ToolCard.tsx'
import { ToolGroup } from './ToolGroup.tsx'

export function Thread({
	roomId,
	messages,
	events,
	attachments,
	queue,
	pending,
	liveText,
	running,
	onApprove,
	onOpen,
	onScrollRatio,
	followScroll,
}: {
	roomId: string
	messages: Message[]
	events: Parameters<typeof buildTimeline>[1]
	attachments: Attachment[]
	queue: QueuedItem[]
	pending: PermissionRequest[]
	liveText: string
	running: boolean
	onApprove: (requestId: string, allow: boolean) => void
	onOpen: (target: ViewerTarget) => void
	onScrollRatio: (ratio: number) => void
	/** Scroll position to mirror while following someone, null otherwise. */
	followScroll: number | null
}) {
	const bottomRef = useRef<HTMLDivElement>(null)
	const scrollRef = useRef<HTMLDivElement>(null)
	const stickyRef = useRef(true)

	const timeline = useMemo(
		() => groupTimeline(buildTimeline(messages, events, attachments)),
		[messages, events, attachments],
	)

	const byMessage = useMemo(() => {
		const map = new Map<string, Attachment[]>()
		for (const attachment of attachments) {
			if (!attachment.messageId) continue
			const list = map.get(attachment.messageId) ?? []
			list.push(attachment)
			map.set(attachment.messageId, list)
		}
		return map
	}, [attachments])

	const queuedIds = useMemo(() => new Set(queue.map((q) => q.id)), [queue])

	useEffect(() => {
		// Suivre quelqu'un prime sur le collage en bas, sinon les deux se battent.
		if (followScroll !== null) return
		if (stickyRef.current) bottomRef.current?.scrollIntoView({ block: 'end' })
	}, [timeline.length, liveText, pending.length, followScroll])

	useEffect(() => {
		if (followScroll === null || !scrollRef.current) return
		applyScrollRatio(scrollRef.current, followScroll)
	}, [followScroll])

	const onScroll = () => {
		const el = scrollRef.current
		if (!el) return
		stickyRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
		onScrollRatio(scrollRatio(el))
	}

	return (
		<div
			ref={scrollRef}
			onScroll={onScroll}
			className="flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6"
		>
			<div className="mx-auto flex max-w-3xl flex-col gap-5">
				{timeline.length === 0 && !running && (
					<div className="py-20 text-center">
						<p className="text-[15px] font-medium">Conversation vide</p>
						<p className="mt-1 text-[13px] text-muted">
							Écris un message — Claude travaille dans le workdir isolé de cette room.
						</p>
					</div>
				)}

				{timeline.map((item) => {
					if (item.kind === 'message') {
						return (
							<MessageBubble
								key={item.key}
								message={item.message}
								attachments={byMessage.get(item.message.id) ?? []}
								roomId={roomId}
								queued={queuedIds.has(item.message.id)}
								onOpen={onOpen}
							/>
						)
					}
					if (item.kind === 'tool') {
						return <ToolCard key={item.key} use={item.use} result={item.result} />
					}
					if (item.kind === 'tools') {
						return <ToolGroup key={item.key} tools={item.tools} />
					}
					return (
						<div key={item.key} className="flex items-center gap-2 md:ml-[42px]">
							<span className="text-[12px] text-muted">📦 fichier</span>
							<FileChip attachment={item.attachment} roomId={roomId} onOpen={onOpen} />
						</div>
					)
				})}

				{pending.map((request) => (
					<PermissionCard
						key={request.requestId}
						request={request}
						onDecide={(allow) => onApprove(request.requestId, allow)}
					/>
				))}

				{running && pending.length === 0 && <StreamingBubble text={liveText} />}

				<div ref={bottomRef} />
			</div>
		</div>
	)
}
