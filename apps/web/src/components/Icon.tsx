/**
 * The app's icon set, drawn as strokes (Lucide, MIT). Emoji rendered a different
 * shape, weight and colour on every OS, and followed neither the text colour nor
 * the disabled state.
 */
export type IconName =
	| 'plus'
	| 'search'
	| 'sun'
	| 'moon'
	| 'monitor'
	| 'key'
	| 'bell'
	| 'bell-off'
	| 'screen'
	| 'settings'
	| 'power'
	| 'trash'
	| 'pencil'
	| 'folder'
	| 'folder-tree'
	| 'list'
	| 'file'
	| 'image'
	| 'fork'
	| 'download'
	| 'close'
	| 'refresh'
	| 'menu'
	| 'stop'
	| 'send'
	| 'paperclip'
	| 'chevron-right'
	| 'chevron-down'
	| 'lock'
	| 'package'
	| 'sparkles'
	| 'terminal'
	| 'check'
	| 'alert'
	| 'book'
	| 'globe'
	| 'wrench'
	| 'archive'

/** 24×24 paths, unfilled, so the stroke weight holds at any size. */
const PATHS: Record<IconName, string> = {
	plus: 'M12 5v14M5 12h14',
	search: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM21 21l-4.35-4.35',
	sun: 'M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
	moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
	monitor: 'M4 4h16v11H4zM9 20h6M12 15v5',
	key: 'M15.5 3a5.5 5.5 0 0 0-5.2 7.3L3 17.6V21h3.4l1.3-1.3v-1.9h1.9l1.6-1.6h1.9l1.1-1.1A5.5 5.5 0 1 0 15.5 3ZM17 7.5h.01',
	bell: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10.5 20a2 2 0 0 0 3 0',
	'bell-off': 'M6 9a6 6 0 0 1 8.4-5.5M18 10c0 5 2 5 2 5H7M10.5 20a2 2 0 0 0 3 0M3 3l18 18',
	screen: 'M3 5h18v12H3zM8 21h8M12 17v4',
	settings:
		'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15h-.3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.5 8.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10a1.6 1.6 0 0 0 1.5 1h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z',
	power: 'M12 4v8M7.8 6.8a7 7 0 1 0 8.4 0',
	trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
	pencil: 'M4 20h4L19.5 8.5a2.8 2.8 0 0 0-4-4L4 16v4ZM14.5 5.5l4 4',
	folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
	'folder-tree': 'M4 4h5l1.5 2H14v4H4zM4 14h5l1.5 2H14v4H4zM17 8h4M19 8v10h-5',
	list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
	file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5',
	image:
		'M4 5h16v14H4zM9 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM5 17l4.5-4.5L14 17M14 15l2.5-2.5L20 16',
	fork: 'M7 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 8v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8M12 12v4',
	download: 'M12 4v11M7.5 11.5 12 16l4.5-4.5M5 20h14',
	close: 'M6 6l12 12M18 6 6 18',
	refresh: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5',
	menu: 'M4 7h16M4 12h16M4 17h16',
	stop: 'M7 7h10v10H7z',
	send: 'M12 19V5M6 11l6-6 6 6',
	paperclip:
		'M20 11.5 12.4 19a4.5 4.5 0 1 1-6.4-6.4l7.6-7.5a3 3 0 1 1 4.3 4.3l-7.6 7.5a1.5 1.5 0 0 1-2.1-2.1l7-7',
	'chevron-right': 'M9 5l7 7-7 7',
	'chevron-down': 'M5 9l7 7 7-7',
	lock: 'M6 11h12v9H6zM9 11V7a3 3 0 0 1 6 0v4',
	package:
		'M12 3 3 7.5V17l9 4.5 9-4.5V7.5L12 3ZM3 7.5 12 12M12 12l9-4.5M12 12v9.5M7.5 5.2 16.5 9.8',
	sparkles:
		'M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7L12 4ZM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z',
	terminal: 'M5 6l5 6-5 6M12 18h7',
	check: 'M5 12.5 9.5 17 19 7',
	alert: 'M12 4 2.5 20h19L12 4ZM12 10v4M12 17.5h.01',
	book: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5V4.5ZM4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 20.5Z',
	globe:
		'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
	archive: 'M3 7h18v4H3zM5 11v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M10 15h4',
	wrench:
		'M14.7 6.3a4.5 4.5 0 0 0 5.9 5.9l-7.5 7.5a2.3 2.3 0 0 1-3.3-3.3l7.5-7.5A4.5 4.5 0 0 0 14.7 6.3Z',
}

export function Icon({
	name,
	size = 16,
	className,
	label,
}: {
	name: IconName
	size?: number
	className?: string
	/** Only set this when the icon alone carries the meaning of the control. */
	label?: string
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.75}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden={label ? undefined : true}
			role={label ? 'img' : undefined}
			aria-label={label}
			focusable="false"
		>
			<title>{label ?? ''}</title>
			<path d={PATHS[name]} />
		</svg>
	)
}
