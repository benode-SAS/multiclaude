import { copyFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { claudeEnv } from '../config.ts'

/**
 * The CLI stores transcripts per project directory, named after the workdir
 * path. Undocumented internal layout, kept in one place so a change to it has
 * a single site to fix.
 */
const projectSlug = (workdir: string) => path.resolve(workdir).replace(/[^a-zA-Z0-9]/g, '-')

const projectsRoot = () =>
	path.join(claudeEnv.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'projects')

export const sessionFile = (workdir: string, sessionId: string) =>
	path.join(projectsRoot(), projectSlug(workdir), `${sessionId}.jsonl`)

/**
 * Makes a session readable from another workdir. `--resume` only looks in the
 * current project, so without this copy a fork starts without the context it
 * is supposed to inherit.
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
