import { config } from '../config.ts'

export type CloneResult = { ok: true; head: string } | { ok: false; error: string }

/** git@host:path, ssh://, https:// and http://, nothing else. */
const GIT_URL = /^(https?:\/\/[^\s]+|ssh:\/\/[^\s]+|[\w.-]+@[\w.-]+:[^\s]+)$/

export const isCloneUrl = (url: string) => GIT_URL.test(url.trim())

const lastLine = (text: string) =>
	text
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.at(-1) ?? ''

/**
 * Clones into the room's workdir, which must be empty: the room becomes the
 * repository rather than containing one, so the agent works at its root.
 *
 * `--` separates the options from the URL, or a URL starting with a dash would
 * be read as a git option. argv is passed without a shell, so nothing else is
 * interpreted.
 */
export async function cloneInto(
	workdir: string,
	repoUrl: string,
	branch?: string,
): Promise<CloneResult> {
	const url = repoUrl.trim()
	if (!isCloneUrl(url)) return { ok: false, error: 'URL de dépôt non reconnue' }

	// An empty `credential.helper` disables any credential manager: a private
	// repository would otherwise open a prompt and hang the request.
	const args = ['-c', 'credential.helper=', '-c', 'core.askPass=', 'clone', '--progress']
	if (config.cloneDepth > 0) args.push('--depth', String(config.cloneDepth))
	if (branch?.trim()) args.push('--branch', branch.trim())
	args.push('--', url, '.')

	let proc: Bun.Subprocess<'ignore', 'pipe', 'pipe'>
	try {
		proc = Bun.spawn(['git', ...args], {
			cwd: workdir,
			stdin: 'ignore',
			stdout: 'pipe',
			stderr: 'pipe',
			env: {
				...process.env,
				// Same reason: no interactive prompt, ever.
				GIT_TERMINAL_PROMPT: '0',
				GIT_ASKPASS: 'echo',
			},
		})
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : 'git introuvable' }
	}

	const timeout = setTimeout(() => proc.kill(), config.cloneTimeoutMs)
	const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited])
	clearTimeout(timeout)

	if (code !== 0) {
		return { ok: false, error: lastLine(stderr) || `git clone a échoué (code ${code})` }
	}

	const head = Bun.spawnSync(['git', 'log', '-1', '--format=%h %s'], { cwd: workdir })
	return { ok: true, head: new TextDecoder().decode(head.stdout).trim() }
}
