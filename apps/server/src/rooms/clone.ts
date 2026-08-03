import { config } from '../config.ts'

export type CloneResult = { ok: true; head: string } | { ok: false; error: string }

/** git@host:path, ssh://, https:// and http://, nothing else. */
const GIT_URL = /^(https?:\/\/[^\s]+|ssh:\/\/[^\s]+|[\w.-]+@[\w.-]+:[^\s]+)$/

export const isCloneUrl = (url: string) => GIT_URL.test(url.trim())

const isHttp = (url: string) => /^https?:\/\//i.test(url)

/**
 * Every forge takes the token as the password, but each expects its own
 * username, and a wrong one is rejected before the token is even read.
 */
function tokenUser(host: string) {
	if (/github/i.test(host)) return 'x-access-token'
	if (/gitlab/i.test(host)) return 'oauth2'
	if (/bitbucket/i.test(host)) return 'x-token-auth'
	return 'git'
}

/** Puts the credentials in the URL; the remote is cleaned up after cloning. */
export function authenticatedUrl(url: string, token: string) {
	try {
		const parsed = new URL(url)
		parsed.username = encodeURIComponent(tokenUser(parsed.host))
		parsed.password = encodeURIComponent(token)
		return parsed.toString()
	} catch {
		return url
	}
}

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
 *
 * Private repositories authenticate one of two ways: a token, over https, or
 * an SSH key already present on the host. Neither is stored — the token lives
 * for the length of the clone and the remote is reset to the plain URL, so the
 * agent never gets to read a credential out of `.git/config`.
 */
export async function cloneInto(
	workdir: string,
	repoUrl: string,
	options: { branch?: string; token?: string } = {},
): Promise<CloneResult> {
	const url = repoUrl.trim()
	if (!isCloneUrl(url)) return { ok: false, error: 'Unrecognised repository URL' }

	const token = options.token?.trim() || config.gitToken
	const authenticated = token && isHttp(url) ? authenticatedUrl(url, token) : url

	// An empty `credential.helper` disables any credential manager: a private
	// repository would otherwise open a prompt and hang the request.
	const args = ['-c', 'credential.helper=', '-c', 'core.askPass=', 'clone', '--progress']
	if (config.cloneDepth > 0) args.push('--depth', String(config.cloneDepth))
	if (options.branch?.trim()) args.push('--branch', options.branch.trim())
	args.push('--', authenticated, '.')

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
				// BatchMode keeps ssh from asking for a passphrase or an unknown
				// host confirmation, both of which would hang the request.
				GIT_SSH_COMMAND: [
					'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new',
					config.gitSshKey ? `-i "${config.gitSshKey}" -o IdentitiesOnly=yes` : '',
				]
					.filter(Boolean)
					.join(' '),
			},
		})
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : 'git not found' }
	}

	const timeout = setTimeout(() => proc.kill(), config.cloneTimeoutMs)
	const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited])
	clearTimeout(timeout)

	if (code !== 0) {
		// git echoes the URL it was given, credentials included, on failure.
		const detail = token ? stderr.replaceAll(token, '***') : stderr
		return { ok: false, error: lastLine(detail) || `git clone failed (code ${code})` }
	}

	if (authenticated !== url) {
		Bun.spawnSync(['git', 'remote', 'set-url', 'origin', url], { cwd: workdir })
	}

	const head = Bun.spawnSync(['git', 'log', '-1', '--format=%h %s'], { cwd: workdir })
	return { ok: true, head: new TextDecoder().decode(head.stdout).trim() }
}
