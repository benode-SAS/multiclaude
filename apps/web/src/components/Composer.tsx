import type { Attachment, RoomStatus } from '@multiclaude/shared'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.ts'
import { formatBytes, isImage } from '../lib/format.ts'
import { TypingIndicator } from './TypingIndicator.tsx'

/** Silence after the last keystroke before we declare the typing over. */
const TYPING_IDLE_MS = 2500

export function Composer({
	roomId,
	status,
	typing,
	onSend,
	onTyping,
}: {
	roomId: string
	status: RoomStatus
	typing: string[]
	onSend: (content: string, attachmentIds: string[]) => void
	onTyping: (typing: boolean) => void
}) {
	const [value, setValue] = useState('')
	const [staged, setStaged] = useState<Attachment[]>([])
	const [uploading, setUploading] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const fileRef = useRef<HTMLInputElement>(null)

	const isTypingRef = useRef(false)
	const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const onTypingRef = useRef(onTyping)
	onTypingRef.current = onTyping

	const stopTyping = () => {
		if (idleTimer.current) clearTimeout(idleTimer.current)
		idleTimer.current = null
		if (!isTypingRef.current) return
		isTypingRef.current = false
		onTypingRef.current(false)
	}

	const signalTyping = () => {
		if (!isTypingRef.current) {
			isTypingRef.current = true
			onTypingRef.current(true)
		}
		if (idleTimer.current) clearTimeout(idleTimer.current)
		idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS)
	}

	// Leaving the room or closing the tab must not leave a stale indicator.
	useEffect(() => stopTyping, [])
	useEffect(() => {
		stopTyping()
	}, [roomId])

	const resize = (el: HTMLTextAreaElement) => {
		el.style.height = 'auto'
		el.style.height = `${Math.min(el.scrollHeight, 260)}px`
	}

	const submit = () => {
		const content = value.trim()
		if (!content && staged.length === 0) return
		stopTyping()
		onSend(
			content,
			staged.map((a) => a.id),
		)
		setValue('')
		setStaged([])
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto'
			textareaRef.current.focus()
		}
	}

	const upload = async (files: FileList | null) => {
		if (!files?.length) return
		setUploading(true)
		try {
			for (const file of Array.from(files)) {
				const attachment = await api.upload(roomId, file)
				setStaged((prev) => [...prev, attachment])
			}
		} finally {
			setUploading(false)
			if (fileRef.current) fileRef.current.value = ''
		}
	}

	return (
		<div className="border-t border-line bg-canvas px-3 pt-2 pb-3 md:px-6 md:pb-4">
			<div className="mx-auto max-w-3xl">
				<TypingIndicator people={typing} />

				{staged.length > 0 && (
					<div className="mb-2 flex flex-wrap gap-2">
						{staged.map((attachment) => (
							<div
								key={attachment.id}
								className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1 text-[12px]"
							>
								<span>{isImage(attachment.mime) ? '🖼️' : '📄'}</span>
								<span className="max-w-[180px] truncate">{attachment.filename}</span>
								<span className="text-muted">{formatBytes(attachment.size)}</span>
								<button
									type="button"
									className="text-muted hover:text-ink"
									onClick={() => setStaged((prev) => prev.filter((a) => a.id !== attachment.id))}
								>
									✕
								</button>
							</div>
						))}
					</div>
				)}

				<div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm focus-within:border-accent/50">
					<button
						type="button"
						onClick={() => fileRef.current?.click()}
						className="flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-panel hover:text-ink"
						title="Joindre un fichier"
					>
						{uploading ? '…' : '📎'}
					</button>
					<input
						ref={fileRef}
						type="file"
						multiple
						hidden
						onChange={(e) => void upload(e.target.files)}
					/>

					<textarea
						ref={textareaRef}
						rows={1}
						value={value}
						placeholder={
							status === 'running'
								? 'Claude travaille — votre message sera mis en file…'
								: 'Écrire…'
						}
						onChange={(e) => {
							setValue(e.target.value)
							resize(e.target)
							if (e.target.value.trim()) signalTyping()
							else stopTyping()
						}}
						onBlur={stopTyping}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault()
								submit()
							}
						}}
						className="max-h-[260px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed outline-none placeholder:text-muted"
					/>

					<button
						type="button"
						onClick={submit}
						disabled={!value.trim() && staged.length === 0}
						className="flex size-9 items-center justify-center rounded-lg bg-accent text-white transition enabled:hover:brightness-95 disabled:opacity-30"
						title="Envoyer"
					>
						↑
					</button>
				</div>

				<p className="mt-1.5 px-1 text-[11px] text-muted">
					Entrée pour envoyer · Maj+Entrée pour un saut de ligne
				</p>
			</div>
		</div>
	)
}
