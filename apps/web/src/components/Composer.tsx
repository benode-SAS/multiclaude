import type { Attachment, RoomStatus } from '@multiclaude/shared'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.ts'
import { formatBytes, isImage } from '../lib/format.ts'
import { TypingIndicator } from './TypingIndicator.tsx'

/** Silence after the last keystroke before we declare the typing over. */
const TYPING_IDLE_MS = 20_000
/**
 * Le signal « je tape » n'était émis qu'à la première touche : le serveur
 * l'expirait donc en pleine frappe. On le rafraîchit tant que ça tape.
 */
const TYPING_HEARTBEAT_MS = 5_000
/** Drafts are shared and persisted, but not on every keystroke. */
const DRAFT_DEBOUNCE_MS = 500

export function Composer({
	roomId,
	status,
	typing,
	drafts,
	draft,
	onSend,
	onTyping,
	onDraft,
}: {
	roomId: string
	status: RoomStatus
	typing: string[]
	drafts: Record<string, string>
	draft: string
	onSend: (content: string, attachmentIds: string[]) => void
	onTyping: (typing: boolean) => void
	onDraft: (content: string) => void
}) {
	const [value, setValue] = useState('')
	const [staged, setStaged] = useState<Attachment[]>([])
	const [uploading, setUploading] = useState(false)
	const [dropping, setDropping] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const fileRef = useRef<HTMLInputElement>(null)

	const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const onDraftRef = useRef(onDraft)
	onDraftRef.current = onDraft
	const hydratedFor = useRef<string | null>(null)

	// The stored draft arrives with the snapshot, after mount: adopt it once per
	// room, and never on top of something already being typed.
	useEffect(() => {
		if (hydratedFor.current === roomId) return
		hydratedFor.current = roomId
		setValue(draft)
	}, [roomId, draft])

	const flushDraft = (content: string) => {
		if (draftTimer.current) clearTimeout(draftTimer.current)
		draftTimer.current = null
		onDraftRef.current(content)
	}

	const queueDraft = (content: string) => {
		if (draftTimer.current) clearTimeout(draftTimer.current)
		draftTimer.current = setTimeout(() => onDraftRef.current(content), DRAFT_DEBOUNCE_MS)
	}

	const isTypingRef = useRef(false)
	const lastSentAt = useRef(0)
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
		const now = Date.now()
		if (!isTypingRef.current || now - lastSentAt.current > TYPING_HEARTBEAT_MS) {
			isTypingRef.current = true
			lastSentAt.current = now
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
		if (draftTimer.current) clearTimeout(draftTimer.current)
		draftTimer.current = null
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

	const upload = async (files: ArrayLike<File> | null) => {
		const list = files ? Array.from(files) : []
		if (list.length === 0) return
		setUploading(true)
		try {
			for (const file of list) {
				const attachment = await api.upload(roomId, file)
				setStaged((prev) => [...prev, attachment])
			}
		} finally {
			setUploading(false)
			if (fileRef.current) fileRef.current.value = ''
		}
	}

	const uploadRef = useRef(upload)
	uploadRef.current = upload

	/**
	 * Dépôt sur toute la fenêtre, pas seulement sur la zone de saisie : viser un
	 * champ étroit avec un fichier est pénible. Le compteur d'entrées évite que
	 * le survol d'un enfant ne fasse clignoter l'incrustation.
	 */
	useEffect(() => {
		let depth = 0
		const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false

		const onEnter = (event: DragEvent) => {
			if (!hasFiles(event)) return
			depth++
			setDropping(true)
		}
		const onOver = (event: DragEvent) => {
			if (hasFiles(event)) event.preventDefault()
		}
		const onLeave = (event: DragEvent) => {
			if (!hasFiles(event)) return
			depth = Math.max(0, depth - 1)
			if (depth === 0) setDropping(false)
		}
		const onDrop = (event: DragEvent) => {
			if (!hasFiles(event)) return
			event.preventDefault()
			depth = 0
			setDropping(false)
			void uploadRef.current(event.dataTransfer?.files ?? null)
		}

		window.addEventListener('dragenter', onEnter)
		window.addEventListener('dragover', onOver)
		window.addEventListener('dragleave', onLeave)
		window.addEventListener('drop', onDrop)
		return () => {
			window.removeEventListener('dragenter', onEnter)
			window.removeEventListener('dragover', onOver)
			window.removeEventListener('dragleave', onLeave)
			window.removeEventListener('drop', onDrop)
		}
	}, [])

	return (
		<div className="border-t border-line bg-canvas px-3 pt-2 pb-3 md:px-6 md:pb-4">
			{dropping && (
				<div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
					<div className="rounded-2xl border-2 border-dashed border-accent px-8 py-6 text-center">
						<p className="text-[15px] font-semibold text-accent">Déposer pour joindre</p>
						<p className="mt-1 text-[13px] text-muted">
							Les fichiers sont déposés dans le dossier de travail de la conversation.
						</p>
					</div>
				</div>
			)}

			<div className="mx-auto max-w-3xl">
				<TypingIndicator people={typing} drafts={drafts} />

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
							queueDraft(e.target.value)
							if (e.target.value.trim()) signalTyping()
							else stopTyping()
						}}
						onBlur={() => {
							stopTyping()
							flushDraft(value)
						}}
						onPaste={(e) => {
							// Une capture d'écran collée arrive en fichier, sans texte :
							// on ne bloque le collage que s'il y a vraiment des fichiers.
							const files = e.clipboardData.files
							if (files.length === 0) return
							e.preventDefault()
							void upload(files)
						}}
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
