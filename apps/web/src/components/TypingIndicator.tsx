import { Avatar } from './Avatar.tsx'

function describe(people: string[]) {
	if (people.length === 1) return `${people[0]} écrit`
	if (people.length === 2) return `${people[0]} et ${people[1]} écrivent`
	return `${people.length} personnes écrivent`
}

/** Fixed height whether or not anyone is typing, so the composer never jumps. */
export function TypingIndicator({ people }: { people: string[] }) {
	return (
		<div className="flex h-5 items-center gap-2 px-1 text-[12px] text-muted">
			{people.length > 0 && (
				<>
					<div className="flex -space-x-1.5">
						{people.slice(0, 3).map((person) => (
							<div key={person} className="rounded-full ring-2 ring-canvas">
								<Avatar author={person} size={18} />
							</div>
						))}
					</div>
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
				</>
			)}
		</div>
	)
}
