import path from 'node:path'

export type Decision = { allow: true } | { allow: false; reason: string }

const ALLOW: Decision = { allow: true }
const ask = (reason: string): Decision => ({ allow: false, reason })

/**
 * Patterns that make a shell command worth a human look. Everything not listed
 * runs unattended — the point is to keep grep/python/curl/build commands quiet
 * while still catching what destroys data, escalates, or reaches outside.
 *
 * Matched against the whole command, so a rule still fires inside `$(…)`,
 * backticks or a pipeline.
 */
const SHELL_RULES: Array<{ reason: string; test: RegExp }> = [
	{ reason: 'privilege escalation', test: /\b(sudo|doas|su)\b/i },
	{
		reason: 'running a downloaded script',
		test: /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z|k)?sh\b/i,
	},
	{
		reason: 'wiping a disk or device',
		test: /\b(shred|mkfs\w*|fdisk|parted|dd)\b|\btruncate\b/i,
	},
	{
		reason: 'database access',
		test: /\b(pg_dump|pg_restore|pg_dumpall|psql|mysql|mysqldump|mongodump|mongorestore|redis-cli)\b/i,
	},
	{
		reason: 'destructive SQL statement',
		test: /\b(drop\s+(table|database|schema|index)|truncate\s+table|delete\s+from|alter\s+table)\b/i,
	},
	{
		reason: 'destructive or publishing git operation',
		test: /\bgit\s+(push|reset\s+--hard|clean\s+-\w*f|filter-branch|rebase\s+--onto)\b/i,
	},
	{
		reason: 'system administration',
		test: /\b(systemctl|service|reboot|shutdown|halt|poweroff|crontab|useradd|usermod|userdel|passwd|mount|umount|iptables|ufw)\b/i,
	},
	{
		reason: 'system package management',
		test: /\b(apt|apt-get|aptitude|yum|dnf|pacman|zypper|snap|brew)\s+(install|remove|purge|upgrade|update)\b/i,
	},
	{ reason: 'package publication', test: /\b(npm|pnpm|yarn|bun)\s+publish\b/i },
	{ reason: 'killing a process', test: /\b(kill|pkill|killall)\b/i },
	{
		reason: 'access to a remote machine',
		test: /\b(ssh|scp|sftp|rsync)\b.*[\w.-]+@|\b(ssh|scp|sftp)\b\s+[\w.-]+@/i,
	},
	{
		reason: 'infrastructure or deployment',
		test: /\b(docker|docker-compose|kubectl|helm|terraform|ansible|aws|gcloud|az|flyctl|vercel)\b/i,
	},
	{
		reason: 'access to secrets',
		test: /(\.ssh\/|\.aws\/|\.gnupg\/|id_[rd]sa|\.pgpass|\.npmrc|\/etc\/(shadow|sudoers))/i,
	},
	{
		reason: 'writing to a system directory',
		test: />\s*\/(etc|usr|bin|sbin|boot|lib|var)\//,
	},
	{ reason: 'fork bomb', test: /:\(\)\s*\{.*\}\s*;?\s*:/ },
]

/**
 * The process runs with the room's workdir as cwd, so a recursive delete on a
 * relative path can only destroy that room's own files — cheap and isolated.
 * What deserves a human is a delete that leaves the workdir, or a blind glob.
 */
function checkRemove(command: string): Decision {
	if (!/\b(rm|rmdir)\b/i.test(command)) return ALLOW
	if (/\b(rm|rmdir)\b[^|;&]*\s+[~/]/i.test(command)) {
		return ask('delete outside the working directory')
	}
	if (/\b(rm|rmdir)\b[^|;&]*\.\.\//i.test(command)) {
		return ask('delete outside the working directory')
	}
	if (/\b(rm|rmdir)\b[^|;&]*\s\*|\brm\b[^|;&]*\s-[a-z]*[rf][a-z]*\s+\*/i.test(command)) {
		return ask('pattern-based delete')
	}
	return ALLOW
}

/** Ownership and mode changes matter when recursive or aimed outside the room. */
function checkPermissions(command: string): Decision {
	if (!/\b(chmod|chown|chgrp)\b/i.test(command)) return ALLOW
	if (/\b(chmod|chown|chgrp)\b[^|;&]*\s-[a-z]*R/i.test(command)) {
		return ask('recursive permission change')
	}
	if (/\b(chmod|chown|chgrp)\b[^|;&]*\s+[~/]/i.test(command)) {
		return ask('permission change outside the working directory')
	}
	return ALLOW
}

export function checkCommand(command: string, extraPatterns: RegExp[] = []): Decision {
	for (const rule of SHELL_RULES) {
		if (rule.test.test(command)) return ask(rule.reason)
	}
	for (const pattern of extraPatterns) {
		if (pattern.test(command)) return ask('pattern blocked by the configuration')
	}
	const removal = checkRemove(command)
	if (!removal.allow) return removal
	return checkPermissions(command)
}

const SECRET_PATH =
	/(\.ssh[/\\]|\.aws[/\\]|\.gnupg[/\\]|id_[rd]sa|\.pgpass|\.npmrc|shadow|sudoers)/i

/** True when a tool target sits outside the room's workdir. */
function escapesWorkdir(target: string, workdir: string) {
	const resolved = path.resolve(workdir, target)
	const base = path.resolve(workdir)
	return resolved !== base && !resolved.startsWith(base + path.sep)
}

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined)

export function classify(
	tool: string,
	input: Record<string, unknown>,
	options: { workdir: string; alwaysAsk: Set<string>; extraPatterns: RegExp[] },
): Decision {
	if (options.alwaysAsk.has(tool)) return ask('tool flagged for confirmation')

	if (tool === 'Bash' || tool === 'BashOutput') {
		const command = asString(input.command)
		if (!command) return ALLOW
		return checkCommand(command, options.extraPatterns)
	}

	if (tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') {
		const target = asString(input.file_path) ?? asString(input.notebook_path)
		if (target && escapesWorkdir(target, options.workdir)) {
			return ask('writing outside the working directory')
		}
		return ALLOW
	}

	if (tool === 'Read') {
		const target = asString(input.file_path)
		if (target && SECRET_PATH.test(target)) return ask('reading a sensitive file')
		return ALLOW
	}

	return ALLOW
}
