import type { SelectionAnchor } from '@multiclaude/shared'
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.ts'
import { formatBytes, isImage } from '../lib/format.ts'
import { applyScrollRatio, scrollRatio } from '../lib/presence.ts'
import { anchorFromPreview, buildPreviewDocument, type PreviewIn } from '../lib/preview-bridge.ts'
import { Markdown } from './Markdown.tsx'

export type ViewerTarget = { relPath: string; filename: string; mime: string; size: number }

const MAX_INLINE = 2 * 1024 * 1024

const TEXT_MIME = /^text\/|^application\/(json|xml|javascript|x-sh|sql)/

const isMarkdown = (target: ViewerTarget) =>
	target.mime === 'text/markdown' || /\.(md|mdx|markdown)$/i.test(target.relPath)

const isHtml = (target: ViewerTarget) =>
	target.mime === 'text/html' || /\.html?$/i.test(target.relPath)

const isText = (target: ViewerTarget) =>
	TEXT_MIME.test(target.mime) || /\.(txt|log|env|ini|conf|toml|ya?ml|csv)$/i.test(target.relPath)

const langOf = (relPath: string) => relPath.split('.').pop()?.toLowerCase() ?? ''

export function FileViewer({
	target,
	roomId,
	onClose,
	onScrollRatio,
	followScroll,
	onSelection,
	highlights,
}: {
	target: ViewerTarget
	roomId: string
	onClose: () => void
	onScrollRatio?: (ratio: number) => void
	followScroll?: number | null
	onSelection?: (anchor: SelectionAnchor | null) => void
	highlights?: Array<{ name: string; bg: string; fg: string; start: number; end: number }>
}) {
	const bodyRef = useRef<HTMLDivElement>(null)
	const frameRef = useRef<HTMLIFrameElement>(null)
	const [content, setContent] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [showSource, setShowSource] = useState(false)

	const post = (message: PreviewIn) => frameRef.current?.contentWindow?.postMessage(message, '*')

	const image = isImage(target.mime)
	const html = isHtml(target)
	const markdown = isMarkdown(target)
	const text = isText(target)
	const inline = image || ((markdown || html || text) && target.size <= MAX_INLINE)
	const rendered = html && !showSource
	const needsContent = inline && !image

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onClose])

	useEffect(() => {
		setShowSource(false)
	}, [target.relPath])

	useEffect(() => {
		if (followScroll === null || followScroll === undefined) return
		if (rendered) {
			post({ type: 'mc-apply-scroll', ratio: followScroll })
			return
		}
		if (bodyRef.current) applyScrollRatio(bodyRef.current, followScroll)
	}, [followScroll, content, rendered])

	// Le document rendu vit dans une origine opaque : tout passe par postMessage.
	useEffect(() => {
		if (!rendered) return
		const onMessage = (event: MessageEvent) => {
			if (event.source !== frameRef.current?.contentWindow) return
			const data = event.data as {
				type?: string
				ratio?: number
				start?: number
				end?: number
				text?: string
			}
			if (data?.type === 'mc-scroll' && typeof data.ratio === 'number') {
				onScrollRatio?.(data.ratio)
			} else if (data?.type === 'mc-selection' && typeof data.start === 'number') {
				onSelection?.(
					anchorFromPreview(
						{ type: 'mc-selection', start: data.start, end: data.end ?? 0, text: data.text ?? '' },
						target.relPath,
					),
				)
			} else if (data?.type === 'mc-selection-clear') {
				onSelection?.(null)
			}
		}
		window.addEventListener('message', onMessage)
		return () => window.removeEventListener('message', onMessage)
	}, [rendered, onScrollRatio, onSelection, target.relPath])

	useEffect(() => {
		if (rendered) post({ type: 'mc-apply-selections', entries: highlights ?? [] })
	}, [rendered, highlights])

	useEffect(() => {
		if (!needsContent) return
		let cancelled = false
		setContent(null)
		setError(null)
		fetch(api.fileUrl(roomId, target.relPath))
			.then((res) => (res.ok ? res.text() : Promise.reject(new Error(`${res.status}`))))
			.then((body) => {
				if (!cancelled) setContent(body)
			})
			.catch(() => {
				if (!cancelled) setError('lecture impossible')
			})
		return () => {
			cancelled = true
		}
	}, [roomId, target.relPath, needsContent])

	return (
		// Fills whatever the parent gives it: a resizable dock on desktop, a
		// full-screen overlay on mobile. No positioning of its own.
		<div className="flex h-full min-h-0 flex-col bg-canvas">
			<header className="flex items-center gap-2 border-b border-line px-3 py-2.5 md:px-4 md:py-3">
				<span>{image ? '🖼️' : html ? '🌐' : markdown ? '📘' : '📄'}</span>
				<div className="min-w-0 flex-1">
					<p className="truncate text-[14px] font-semibold" title={target.relPath}>
						{target.relPath}
					</p>
					<p className="text-[11px] text-muted">
						{target.mime} · {formatBytes(target.size)}
					</p>
				</div>

				{html && inline && (
					<div className="flex overflow-hidden rounded-lg border border-line">
						{(['aperçu', 'source'] as const).map((label, index) => (
							<button
								key={label}
								type="button"
								onClick={() => setShowSource(index === 1)}
								className={clsx(
									'px-2.5 py-1.5 text-[13px] transition',
									showSource === (index === 1)
										? 'bg-accent text-white'
										: 'bg-surface hover:bg-panel',
								)}
							>
								{label}
							</button>
						))}
					</div>
				)}

				<a
					href={api.fileUrl(roomId, target.relPath, true)}
					title="Télécharger"
					className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] transition hover:border-accent/50"
				>
					<span className="hidden lg:inline">Télécharger</span>
					<span className="lg:hidden">↓</span>
				</a>
				<button
					type="button"
					onClick={onClose}
					className="rounded-lg px-2 py-1.5 text-[15px] text-muted transition hover:bg-panel hover:text-ink"
				>
					✕
				</button>
			</header>

			<div
				ref={bodyRef}
				onScroll={(e) => onScrollRatio?.(scrollRatio(e.currentTarget))}
				data-selection-scope="viewer"
				data-selection-key={target.relPath}
				className={clsx('min-h-0 flex-1 overflow-auto bg-surface', !rendered && 'px-5 py-4')}
			>
				{image && (
					<img
						src={api.fileUrl(roomId, target.relPath)}
						alt={target.filename}
						className="mx-auto max-h-full object-contain"
					/>
				)}

				{rendered && content !== null && (
					// allow-scripts sans allow-same-origin : la page s'exécute dans une
					// origine opaque — assez pour s'instrumenter, pas pour atteindre le
					// DOM, le stockage ni l'API de l'app. Dialogue par postMessage.
					<iframe
						key={target.relPath}
						ref={frameRef}
						srcDoc={buildPreviewDocument(
							content,
							`${api.rawUrl(roomId, target.relPath.split('/').slice(0, -1).join('/'))}/`,
						)}
						title={target.filename}
						sandbox="allow-scripts"
						className="h-full w-full border-0 bg-white"
					/>
				)}

				{!image && !inline && (
					<p className="py-10 text-center text-[13px] text-muted">
						Aperçu indisponible pour ce type de fichier — utilise le téléchargement.
					</p>
				)}

				{needsContent && error && (
					<p className="py-10 text-center text-[13px] text-danger">{error}</p>
				)}

				{needsContent && content === null && !error && (
					<p className="py-10 text-center text-[13px] text-muted">Chargement…</p>
				)}

				{needsContent && content !== null && !rendered && (
					<Markdown>
						{markdown ? content : `\`\`\`${langOf(target.relPath)}\n${content}\n\`\`\``}
					</Markdown>
				)}
			</div>
		</div>
	)
}
