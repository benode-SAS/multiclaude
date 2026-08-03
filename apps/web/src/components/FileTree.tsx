import clsx from 'clsx'
import { useState } from 'react'
import { collapseChains, type TreeNode } from '../lib/file-tree.ts'
import { formatBytes, isImage } from '../lib/format.ts'
import type { ViewerTarget } from './FileViewer.tsx'
import { Icon } from './Icon.tsx'

const INDENT = 14

export function FileTree({
	nodes,
	onOpen,
	activePath,
}: {
	nodes: TreeNode[]
	onOpen: (target: ViewerTarget) => void
	activePath?: string | null
}) {
	// Collapsed rather than expanded: a workdir opens fully unfolded, which is
	// what one wants when looking for the file the agent just wrote.
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

	const toggle = (path: string) =>
		setCollapsed((current) => {
			const next = new Set(current)
			if (!next.delete(path)) next.add(path)
			return next
		})

	const render = (list: TreeNode[], depth: number): React.ReactNode =>
		list.map((node) => {
			const pad = { paddingLeft: 8 + depth * INDENT }

			if (node.kind === 'dir') {
				const shut = collapsed.has(node.path)
				return (
					<div key={node.path}>
						<button
							type="button"
							onClick={() => toggle(node.path)}
							style={pad}
							className="flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-[13px] transition hover:bg-surface"
						>
							<Icon
								name={shut ? 'chevron-right' : 'chevron-down'}
								size={13}
								className="w-3 shrink-0 text-muted"
							/>
							<span className="truncate font-medium">{node.name}</span>
							<span className="ml-auto shrink-0 pl-2 text-[11px] text-muted">{node.files}</span>
						</button>
						{!shut && render(node.children, depth + 1)}
					</div>
				)
			}

			return (
				<button
					key={node.path}
					type="button"
					onClick={() =>
						onOpen({
							relPath: node.file.relPath,
							filename: node.file.name,
							mime: node.file.mime,
							size: node.file.size,
						})
					}
					style={pad}
					title={node.path}
					className={clsx(
						'flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-[13px] transition hover:bg-surface',
						node.path === activePath && 'bg-surface',
					)}
				>
					<span className="w-3 shrink-0" />
					<Icon
						name={isImage(node.file.mime) ? 'image' : 'file'}
						size={13}
						className="shrink-0 text-muted"
					/>
					<span className="truncate">{node.name}</span>
					<span className="ml-auto shrink-0 pl-2 text-[11px] text-muted">
						{formatBytes(node.file.size)}
					</span>
				</button>
			)
		})

	return <div>{render(collapseChains(nodes), 0)}</div>
}
