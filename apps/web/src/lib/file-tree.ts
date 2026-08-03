import type { FileEntry } from '@multiclaude/shared'

export type TreeNode =
	| { kind: 'file'; name: string; path: string; file: FileEntry }
	| { kind: 'dir'; name: string; path: string; children: TreeNode[]; files: number }

const isDir = (node: TreeNode): node is Extract<TreeNode, { kind: 'dir' }> => node.kind === 'dir'

/** Directories first, then names, case-insensitive — what a file browser does. */
const order = (a: TreeNode, b: TreeNode) =>
	isDir(a) === isDir(b)
		? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
		: isDir(a)
			? -1
			: 1

/**
 * Rebuilds the directory structure from the flat listing: the server walks the
 * workdir and returns paths, the shape is only ever needed on screen.
 */
export function buildTree(files: FileEntry[]): TreeNode[] {
	const root: TreeNode[] = []
	const dirs = new Map<string, Extract<TreeNode, { kind: 'dir' }>>()

	const dirAt = (path: string): TreeNode[] => {
		if (!path) return root
		const existing = dirs.get(path)
		if (existing) return existing.children

		const cut = path.lastIndexOf('/')
		const node: Extract<TreeNode, { kind: 'dir' }> = {
			kind: 'dir',
			name: path.slice(cut + 1),
			path,
			children: [],
			files: 0,
		}
		dirs.set(path, node)
		dirAt(cut === -1 ? '' : path.slice(0, cut)).push(node)
		return node.children
	}

	for (const file of files) {
		const cut = file.relPath.lastIndexOf('/')
		const parent = cut === -1 ? '' : file.relPath.slice(0, cut)
		dirAt(parent).push({ kind: 'file', name: file.name, path: file.relPath, file })

		// Counted on every ancestor, so a collapsed folder still says how much
		// it hides.
		for (let at = parent; at; at = at.slice(0, Math.max(at.lastIndexOf('/'), 0))) {
			const dir = dirs.get(at)
			if (dir) dir.files += 1
			if (!at.includes('/')) break
		}
	}

	const sort = (nodes: TreeNode[]): TreeNode[] => {
		nodes.sort(order)
		for (const node of nodes) if (isDir(node)) sort(node.children)
		return nodes
	}
	return sort(root)
}

/**
 * Folders holding a single folder are shown as one row (`src/components`), the
 * way editors do: chains of empty intermediates cost depth and say nothing.
 */
export function collapseChains(nodes: TreeNode[]): TreeNode[] {
	return nodes.map((node) => {
		if (!isDir(node)) return node
		let current = node
		while (current.children.length === 1 && isDir(current.children[0]!)) {
			const only = current.children[0] as Extract<TreeNode, { kind: 'dir' }>
			current = { ...only, name: `${current.name}/${only.name}` }
		}
		return { ...current, children: collapseChains(current.children) }
	})
}
