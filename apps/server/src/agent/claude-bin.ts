import { existsSync, realpathSync } from 'node:fs'
import path from 'node:path'

const posix = (p: string) => p.split(path.sep).join('/')

/**
 * npm installs `claude` as a shell shim (.cmd / .ps1 / sh script) which cannot
 * be spawned directly — resolve through to the packaged binary.
 */
function resolve(): string {
	if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN

	const found = Bun.which('claude')
	if (!found) return 'claude'

	const real = realpathSync(found)
	const packaged = path.resolve(
		path.dirname(real),
		'../@anthropic-ai/claude-code/bin',
		process.platform === 'win32' ? 'claude.exe' : 'claude',
	)
	if (existsSync(packaged)) return posix(packaged)
	return posix(real)
}

export const claudeBin = resolve()
