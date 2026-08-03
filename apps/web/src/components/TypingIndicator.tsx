import { useState } from 'react'
import { Avatar } from './Avatar.tsx'
import { Icon } from './Icon.tsx'

function describe(people: string[]) {
	if (people.length === 1) return `${people[0]} écrit`
	if (people.length === 2) return `${people[0]} et ${people[1]} écrivent`
	return `${people.length} personnes écrivent`
}

/** Fixed height whether or not anyone is typing, so the composer never jumps. */
export function TypingIndicator({
	people,
	drafts,
}: {
	people: string[]
	drafts: Record<string, string>
}) {
	const [peeking, setPeeking] = useState(false)

	const previews = people
		.map((person) => ({ person, content: drafts[person]?.trim() ?? '' }))
		.filter((entry) => entry.content)

	return (
		<div className="relative flex h-5 items-center gap-2 px-1 text-[12px] text-muted">
			{people.length > 0 && (
				<>
					<div className="flex -space-x-1.5">
						{people.slice(0, 3).map((person) => (
							<div key={person} className="rounded-full ring-2 ring-canvas">
								<Avatar author={person} size={18} />
							</div>
						))}
					</div>

					{/* Hidden by default: showing it permanently would eat the space
					    under the input. */}
					<button
						type="button"
						onMouseEnter={() => setPeeking(true)}
						onMouseLeave={() => setPeeking(false)}
						onFocus={() => setPeeking(true)}
						onBlur={() => setPeeking(false)}
						onClick={() => setPeeking((open) => !open)}
						className="flex items-center gap-2 rounded transition hover:text-ink"
						title={previews.length ? 'Voir ce qui est en train de s’écrire' : undefined}
					>
						<span>{describe(people)}</span>
						<span className="flex gap-0.5">
							{[0, 1, 2].map((dot) => (
								<span
									key={dot}
									className="size-1 animate-bounce rounded-full bg-muted"
									style={{ animationDelay: `${dot * 150}ms` }}
								/>
							))}
						</span>
						{previews.length > 0 && <Icon name="chevron-down" size={11} className="opacity-60" />}
					</button>

					{peeking && previews.length > 0 && (
						<div className="absolute bottom-6 left-0 z-20 w-full max-w-lg rounded-xl border border-line bg-surface p-3 shadow-xl">
							{previews.map((entry) => (
								<div key={entry.person} className="mb-2 last:mb-0">
									<div className="mb-1 flex items-center gap-1.5">
										<Avatar author={entry.person} size={16} />
										<span className="text-[11px] font-medium">{entry.person}</span>
									</div>
									<p className="max-h-32 overflow-auto text-[12px] leading-relaxed whitespace-pre-wrap text-ink">
										{entry.content}
									</p>
								</div>
							))}
						</div>
					)}
				</>
			)}
		</div>
	)
}
