import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { formatBytes, isImage } from '../lib/format.ts'
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
}: {
	target: ViewerTarget
	roomId: string
	onClose: () => void
}) {
	const [content, setContent] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [showSource, setShowSource] = useState(false)

	const image = isImage(target.mime)
	const html = isHtml(target)
	const markdown = isMarkdown(target)
	const text = isText(target)
	const inline = image || ((markdown || html || text) && target.size <= MAX_INLINE)
	const rendered = html && !showSource
	const needsContent = inline && !image && !rendered

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onClose])

	useEffect(() => {
		setShowSource(false)
	}, [target.relPath])

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
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
			onClick={onClose}
			role="presentation"
		>
			<div
				className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-canvas shadow-2xl"
				onClick={(e) => e.stopPropagation()}
				role="presentation"
			>
				<header className="flex items-center gap-3 border-b border-line px-4 py-3">
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
						className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] transition hover:border-accent/50"
					>
						Télécharger
					</a>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg px-2 py-1.5 text-[15px] text-muted transition hover:bg-panel hover:text-ink"
					>
						✕
					</button>
				</header>

				<div className={clsx('min-h-0 flex-1 overflow-auto bg-surface', !rendered && 'px-5 py-4')}>
					{image && (
						<img
							src={api.fileUrl(roomId, target.relPath)}
							alt={target.filename}
							className="mx-auto max-h-[70vh] object-contain"
						/>
					)}

					{rendered && (
						// sandbox without allow-same-origin: the page cannot reach this app's
						// origin, its storage, or its API — an agent-authored file stays inert.
						<iframe
							key={target.relPath}
							src={api.fileUrl(roomId, target.relPath)}
							title={target.filename}
							sandbox=""
							className="h-[70vh] w-full border-0 bg-white"
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

					{needsContent && content !== null && (
						<Markdown>
							{markdown ? content : `\`\`\`${langOf(target.relPath)}\n${content}\n\`\`\``}
						</Markdown>
					)}
				</div>
			</div>
		</div>
	)
}
