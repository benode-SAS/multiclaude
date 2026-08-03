const { existsSync } = require('node:fs')
const os = require('node:os')
const path = require('node:path')

/**
 * PM2 does not always find bun: its PATH at boot time is minimal. Resolved here,
 * when the config is read, rather than left to chance.
 */
const bun =
	[
		process.env.BUN_BIN,
		path.join(os.homedir(), '.bun/bin/bun'),
		'/usr/local/bin/bun',
		'/usr/bin/bun',
	].find((candidate) => candidate && existsSync(candidate)) || 'bun'

/**
 * PM2 config — has to stay .cjs: package.json declares "type": "module" and PM2
 * loads this file with require().
 *
 * Application configuration is not here but in the .env at the root: bun loads
 * it automatically from the cwd, which keeps server settings out of the
 * repository and leaves a single place to edit.
 *
 *   cd /var/www/multiclaude/multiclaude
 *   bun install && bun run build && bun run db:migrate
 *   pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
	apps: [
		{
			name: 'multiclaude',

			// bun is launched as a command, not as a PM2 "interpreter": that
			// container loads the script with require(), which fails as soon as a
			// module in the chain is async. `interpreter: 'none'` avoids it.
			script: bun,
			args: 'apps/server/src/index.ts',
			interpreter: 'none',
			cwd: __dirname,

			// One process, and only one: room state (runtimes, queues, pending
			// permissions, sockets) lives in memory. Cluster mode would spread
			// requests across processes sharing nothing — the failures would be
			// intermittent and unreadable.
			exec_mode: 'fork',
			instances: 1,

			autorestart: true,
			watch: false,

			// A crash at boot (missing migration, claude binary not found) must not
			// turn into a restart loop.
			min_uptime: '20s',
			max_restarts: 10,
			restart_delay: 3000,

			// Each room spawns a child `claude` process, hungrier than the server
			// itself. PM2 only measures the parent: a low threshold would just
			// restart the server without addressing the real cause.
			max_memory_restart: '1G',

			// SIGINT triggers disposeAll(), which stops the child claude processes.
			// Too short a timeout would orphan them after PM2's SIGKILL.
			kill_timeout: 10000,

			merge_logs: true,
			time: true,
			out_file: 'logs/multiclaude.out.log',
			error_file: 'logs/multiclaude.err.log',

			env: {
				NODE_ENV: 'production',
			},
		},
	],
}
