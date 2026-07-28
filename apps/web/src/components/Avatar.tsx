import { authorColor, initials } from '../lib/format.ts'

export function Avatar({ author, size = 30 }: { author: string; size?: number }) {
	const { bg, fg } = authorColor(author)
	return (
		<div
			className="flex shrink-0 items-center justify-center rounded-full font-semibold select-none"
			style={{
				background: bg,
				color: fg,
				width: size,
				height: size,
				fontSize: size * 0.4,
			}}
			title={author}
		>
			{initials(author)}
		</div>
	)
}
