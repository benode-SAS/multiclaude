import { useEffect, useRef, useState } from 'react'
import { api, type SearchHit } from '../lib/api.ts'
import { formatDay } from '../lib/format.ts'
import { Icon } from './Icon.tsx'

const DEBOUNCE_MS = 250

export function SearchBox({ onOpen }: { onOpen: (roomId: string) => void }) {
	const [query, setQuery] = useState('')
	const [hits, setHits] = useState<SearchHit[]>([])
	const [busy, setBusy] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		if (timer.current) clearTimeout(timer.current)
		if (query.trim().length < 2) {
			setHits([])
			return
		}
		setBusy(true)
		timer.current = setTimeout(() => {
			api
				.search(query)
				.then(setHits)
				.catch(() => setHits([]))
				.finally(() => setBusy(false))
		}, DEBOUNCE_MS)
		return () => {
			if (timer.current) clearTimeout(timer.current)
		}
	}, [query])

	return (
		<div className="px-3 pb-2">
			<div className="relative">
				<Icon
					name="search"
					size={14}
					className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted"
				/>
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search…"
					className="w-full rounded-lg border border-line bg-surface py-1.5 pr-8 pl-8 text-[13px] outline-none focus:border-accent/60"
				/>
				{query && (
					<button
						type="button"
						onClick={() => setQuery('')}
						className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted transition hover:text-ink"
					>
						<Icon name="close" size={14} label="Clear" />
					</button>
				)}
			</div>

			{query.trim().length >= 2 && (
				<div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface">
					{busy && hits.length === 0 && (
						<p className="px-3 py-2 text-[12px] text-muted">Searching…</p>
					)}
					{!busy && hits.length === 0 && (
						<p className="px-3 py-2 text-[12px] text-muted">No results.</p>
					)}
					{hits.map((hit) => (
						<button
							key={hit.messageId}
							type="button"
							onClick={() => {
								onOpen(hit.roomId)
								setQuery('')
							}}
							className="block w-full border-b border-line px-3 py-2 text-left last:border-b-0 hover:bg-panel"
						>
							<div className="flex items-baseline gap-2">
								<span className="min-w-0 flex-1 truncate text-[12px] font-medium">
									{hit.roomTitle}
								</span>
								<span className="shrink-0 text-[10px] text-muted">{formatDay(hit.createdAt)}</span>
							</div>
							<p className="mt-0.5 line-clamp-2 text-[11px] text-muted">
								{hit.author === 'claude' ? 'Claude' : hit.author} : {hit.excerpt}
							</p>
						</button>
					))}
				</div>
			)}
		</div>
	)
}
