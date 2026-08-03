import type { Presence, SelectionAnchor } from '@multiclaude/shared'
import { authorColor } from './format.ts'

const MAX_TEXT = 400
const CONTAINER = '[data-selection-key]'

/** Text nodes of a container, in document order. */
function textNodes(root: Node) {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
	const nodes: Text[] = []
	let node = walker.nextNode()
	while (node) {
		nodes.push(node as Text)
		node = walker.nextNode()
	}
	return nodes
}

/**
 * Absolute character offset of a boundary point within `root`.
 *
 * Measured with a probe range rather than by walking text nodes: a double or
 * triple click yields element boundaries (`<p>`, child index) that no text-node
 * scan would ever match.
 */
function offsetIn(root: Element, node: Node, offset: number) {
	const probe = document.createRange()
	probe.selectNodeContents(root)
	try {
		probe.setEnd(node, offset)
	} catch {
		return null
	}
	return probe.toString().length
}

/**
 * Describes the live selection relative to the container it sits in. Returns
 * null when the selection is empty or outside any anchorable region.
 */
export function describeSelection(): SelectionAnchor | null {
	const selection = window.getSelection()
	if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

	const range = selection.getRangeAt(0)
	const text = selection.toString()
	if (!text.trim()) return null

	const start = range.startContainer
	const element = (
		start.nodeType === Node.TEXT_NODE ? start.parentElement : start
	) as Element | null
	const container = element?.closest(CONTAINER)
	if (!container) return null

	// A triple click often spills into the next block; clamp to the container
	// rather than dropping the selection.
	const from = offsetIn(container, range.startContainer, range.startOffset) ?? 0
	const to =
		offsetIn(container, range.endContainer, range.endOffset) ?? container.textContent?.length ?? 0
	if (from === to) return null

	return {
		scope: container.getAttribute('data-selection-scope') === 'viewer' ? 'viewer' : 'message',
		key: container.getAttribute('data-selection-key') ?? '',
		start: Math.min(from, to),
		end: Math.max(from, to),
		text: text.slice(0, MAX_TEXT),
	}
}

/** Rebuilds a DOM range from an anchor, or null if the content moved on. */
function resolveRange(anchor: SelectionAnchor): Range | null {
	const container = document.querySelector(
		`[data-selection-key="${CSS.escape(anchor.key)}"][data-selection-scope="${anchor.scope}"]`,
	)
	if (!container) return null

	const range = document.createRange()
	const nodes = textNodes(container)
	let cursor = 0
	let started = false

	for (const text of nodes) {
		const next = cursor + text.data.length
		if (!started && anchor.start <= next) {
			range.setStart(text, Math.max(0, anchor.start - cursor))
			started = true
		}
		if (started && anchor.end <= next) {
			range.setEnd(text, Math.max(0, anchor.end - cursor))
			return range
		}
		cursor = next
	}

	if (!started) return null
	// The end boundary ran past the content: stick to the end instead of
	// returning an empty range, which would show nothing.
	const last = nodes.at(-1)
	if (!last) return null
	range.setEnd(last, last.data.length)
	return range
}

const HIGHLIGHT_PREFIX = 'mc-sel-'
const STYLE_ID = 'mc-selection-styles'
const key = (pseudo: string) => `${HIGHLIGHT_PREFIX}${pseudo.replace(/[^a-zA-Z0-9_-]/g, '_')}`

const supported = () => typeof CSS !== 'undefined' && 'highlights' in CSS

/**
 * Paints everyone's selection at once, with the author's colour. Uses the
 * Custom Highlight API: no DOM surgery, so React keeps owning the markup and
 * markdown re-renders cannot fight the highlight.
 */
export function paintSelections(presences: Presence[]) {
	if (!supported()) return

	for (const name of [...CSS.highlights.keys()]) {
		if (name.startsWith(HIGHLIGHT_PREFIX)) CSS.highlights.delete(name)
	}

	const rules: string[] = []
	for (const presence of presences) {
		if (!presence.selection) continue
		const range = resolveRange(presence.selection)
		if (!range) continue

		const name = key(presence.pseudo)
		CSS.highlights.set(name, new Highlight(range))
		const { bg, fg } = authorColor(presence.pseudo)
		rules.push(`::highlight(${name}) { background-color: ${bg}; color: ${fg}; }`)
	}

	let style = document.getElementById(STYLE_ID)
	if (!style) {
		style = document.createElement('style')
		style.id = STYLE_ID
		document.head.append(style)
	}
	style.textContent = rules.join('\n')
}

export const selectionsSupported = supported

/** Selections aimed at the open document, ready to send into the preview. */
export function previewHighlights(presences: Presence[], filePath: string | null) {
	if (!filePath) return []
	return presences.flatMap((presence) => {
		const anchor = presence.selection
		if (anchor?.scope !== 'viewer' || anchor.key !== filePath) return []
		const { bg, fg } = authorColor(presence.pseudo)
		return [{ name: key(presence.pseudo), bg, fg, start: anchor.start, end: anchor.end }]
	})
}
