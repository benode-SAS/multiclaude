import { copyFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { claudeEnv } from '../config.ts'

/**
 * Le CLI range les transcriptions par répertoire de projet, sous un nom dérivé
 * du chemin de travail. C'est une disposition interne, non documentée : elle
 * est isolée ici pour n'avoir qu'un endroit à corriger si elle change.
 */
const projectSlug = (workdir: string) => path.resolve(workdir).replace(/[^a-zA-Z0-9]/g, '-')

const projectsRoot = () =>
	path.join(claudeEnv.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'projects')

export const sessionFile = (workdir: string, sessionId: string) =>
	path.join(projectsRoot(), projectSlug(workdir), `${sessionId}.jsonl`)

/**
 * Rend la session lisible depuis un autre dossier de travail. Sans cette copie,
 * `--resume` ne trouve rien : il ne cherche que dans le projet courant, et un
 * fork démarrerait sans le contexte qu'il est censé hériter.
 */
export async function copySessionTo(
	fromWorkdir: string,
	toWorkdir: string,
	sessionId: string,
): Promise<boolean> {
	const source = sessionFile(fromWorkdir, sessionId)
	const target = sessionFile(toWorkdir, sessionId)
	try {
		await mkdir(path.dirname(target), { recursive: true })
		await copyFile(source, target)
		return true
	} catch {
		return false
	}
}
