import { memo, type ReactNode, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

function extractText(node: ReactNode): string {
	if (node == null || typeof node === 'boolean') return ''
	if (typeof node === 'string' || typeof node === 'number') return String(node)
	if (Array.isArray(node)) return node.map(extractText).join('')
	if (typeof node === 'object' && 'props' in node) {
		return extractText((node.props as { children?: ReactNode }).children)
	}
	return ''
}

function CodeBlock({ children }: { children?: ReactNode }) {
	const [copied, setCopied] = useState(false)

	const copy = async () => {
		await navigator.clipboard.writeText(extractText(children))
		setCopied(true)
		setTimeout(() => setCopied(false), 1400)
	}

	return (
		<div className="group relative">
			<button
				type="button"
				onClick={copy}
				// Visible d'emblée au toucher : sans survol, le bouton n'existait pas.
				className="absolute top-2 right-2 rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-muted transition hover:text-ink max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100"
			>
				{copied ? 'copié' : 'copier'}
			</button>
			<pre>{children}</pre>
		</div>
	)
}

export const Markdown = memo(function Markdown({ children }: { children: string }) {
	return (
		<div className="prose-chat text-[15px]">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				// Sans langue déclarée, pas de coloration : la détection automatique
				// prenait la prose des blocs sans langage pour du code et repeignait
				// des paragraphes entiers en couleur de chaîne.
				rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
				components={{
					pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
					a: ({ children, href }) => (
						<a href={href} target="_blank" rel="noreferrer">
							{children}
						</a>
					),
					table: ({ children }) => (
						<div className="overflow-x-auto">
							<table>{children}</table>
						</div>
					),
				}}
			>
				{children}
			</ReactMarkdown>
		</div>
	)
})
