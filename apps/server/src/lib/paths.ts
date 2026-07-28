import path from 'node:path'

/** Resolve a client-supplied relative path inside `root`, or throw on traversal. */
export function safeJoin(root: string, relPath: string) {
	const normalized = path.normalize(relPath).replace(/^([/\\])+/, '')
	const target = path.resolve(root, normalized)
	const base = path.resolve(root)
	if (target !== base && !target.startsWith(base + path.sep)) {
		throw new Error(`path escapes workdir: ${relPath}`)
	}
	return target
}

export function toRelPath(root: string, absPath: string) {
	return path.relative(root, absPath).split(path.sep).join('/')
}

const MIME: Record<string, string> = {
	'.txt': 'text/plain',
	'.md': 'text/markdown',
	'.json': 'application/json',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.cjs': 'text/javascript',
	'.ts': 'text/typescript',
	'.tsx': 'text/typescript',
	'.jsx': 'text/javascript',
	'.css': 'text/css',
	'.html': 'text/html',
	'.csv': 'text/csv',
	'.yml': 'text/yaml',
	'.yaml': 'text/yaml',
	'.toml': 'text/plain',
	'.sh': 'text/x-sh',
	'.py': 'text/x-python',
	'.sql': 'text/plain',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.pdf': 'application/pdf',
	'.zip': 'application/zip',
	'.mp4': 'video/mp4',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
}

export function mimeOf(filePath: string) {
	return MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', '.turbo', '.cache'])

/** Write/Edit land through `foo.ts.tmp.<pid>.<hash>` before being renamed. */
const TEMP = /\.tmp\.\d+\.[0-9a-f]+$/i

/** Noisy directories never worth listing or watching. */
export function isIgnoredDir(relPath: string) {
	return relPath.split('/').some((part) => IGNORED.has(part))
}

/**
 * Hidden from listings. Temp files must still *trigger* a rescan — on Windows
 * they are the only fs event emitted for an agent write.
 */
export function isIgnored(relPath: string) {
	return isIgnoredDir(relPath) || TEMP.test(relPath.split('/').at(-1) ?? '')
}
