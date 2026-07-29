import { existsSync, realpathSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const posix = (p: string) => p.split(path.sep).join('/')
const exe = process.platform === 'win32' ? 'claude.exe' : 'claude'

/**
 * Where the CLI usually lands when PATH is minimal — typical under systemd,
 * which does not inherit a login shell's PATH.
 */
const FALLBACKS = [
	path.join(os.homedir(), '.local/bin', exe),
	path.join(os.homedir(), '.bun/bin', exe),
	`/usr/local/bin/${exe}`,
	`/usr/bin/${exe}`,
]

/**
 * npm installs `claude` as a shell shim (.cmd / .ps1 / sh script) which cannot
 * be spawned directly — resolve through to the packaged binary.
 */
function throughShim(entry: string) {
	const real = realpathSync(entry)
	const packaged = path.resolve(path.dirname(real), '../@anthropic-ai/claude-code/bin', exe)
	return posix(existsSync(packaged) ? packaged : real)
}

function resolve(): string {
	if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN

	const found = Bun.which('claude')
	if (found) return throughShim(found)

	for (const candidate of FALLBACKS) {
		if (existsSync(candidate)) return throughShim(candidate)
	}
	// Let the spawn fail with a reported error rather than guessing further.
	return 'claude'
}

export const claudeBin = resolve()
export const claudeBinResolved = claudeBin !== 'claude' || Boolean(Bun.which('claude'))
