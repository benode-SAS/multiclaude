import { config } from '../config.ts'

export type CloneResult = { ok: true; head: string } | { ok: false; error: string }

/** git@host:path, ssh://, https:// et http:// — rien d'autre. */
const GIT_URL = /^(https?:\/\/[^\s]+|ssh:\/\/[^\s]+|[\w.-]+@[\w.-]+:[^\s]+)$/

export const isCloneUrl = (url: string) => GIT_URL.test(url.trim())

const lastLine = (text: string) =>
	text
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.at(-1) ?? ''

/**
 * Clone dans le workdir de la room, qui doit être vide — la room devient le
 * dépôt plutôt que d'en contenir un, pour que l'agent travaille à la racine.
 *
 * `--` sépare les options de l'URL : sans lui, une URL commençant par un tiret
 * serait lue comme une option de git. L'argv est passé sans shell, donc rien
 * n'est interprété.
 */
export async function cloneInto(
	workdir: string,
	repoUrl: string,
	branch?: string,
): Promise<CloneResult> {
	const url = repoUrl.trim()
	if (!isCloneUrl(url)) return { ok: false, error: 'URL de dépôt non reconnue' }

	// `credential.helper=` vide neutralise tout gestionnaire d'identifiants : sans
	// ça un dépôt privé ouvre une invite et la requête reste suspendue.
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
				// Sans ça, un dépôt privé bloquerait le serveur sur une invite.
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
