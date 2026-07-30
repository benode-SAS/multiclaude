import { useEffect, useRef, useState } from 'react'
import { api, type SearchHit } from '../lib/api.ts'
import { formatDay } from '../lib/format.ts'

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
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Rechercher…"
					className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-accent/60"
				/>
				{query && (
					<button
						type="button"
						onClick={() => setQuery('')}
						className="absolute top-1/2 right-2 -translate-y-1/2 text-[12px] text-muted hover:text-ink"
					>
						✕
					</button>
				)}
			</div>

			{query.trim().length >= 2 && (
				<div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface">
					{busy && hits.length === 0 && (
						<p className="px-3 py-2 text-[12px] text-muted">Recherche…</p>
					)}
					{!busy && hits.length === 0 && (
						<p className="px-3 py-2 text-[12px] text-muted">Aucun résultat.</p>
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
