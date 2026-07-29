const { existsSync } = require('node:fs')
const os = require('node:os')
const path = require('node:path')

/**
 * PM2 ne trouve pas toujours bun : son PATH au démarrage au boot est minimal.
 * Résolu ici, à la lecture de la config, plutôt que laissé au hasard.
 */
const bun =
	[
		process.env.BUN_BIN,
		path.join(os.homedir(), '.bun/bin/bun'),
		'/usr/local/bin/bun',
		'/usr/bin/bun',
	].find((candidate) => candidate && existsSync(candidate)) || 'bun'

/**
 * Config PM2 — doit rester en .cjs : le package.json déclare "type": "module",
 * et PM2 charge ce fichier avec require().
 *
 * La configuration applicative n'est pas ici mais dans le .env à la racine :
 * bun le charge automatiquement depuis le cwd, ce qui évite de committer des
 * réglages serveur et garde un seul endroit à éditer.
 *
 *   cd /var/www/multiclaude/multiclaude
 *   bun install && bun run build && bun run db:migrate
 *   pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
	apps: [
		{
			name: 'multiclaude',

			// bun est lancé comme une commande, pas comme un « interpréteur » PM2 :
			// son conteneur bun charge le script avec require(), ce qui échoue dès
			// qu'un module de la chaîne est async. `interpreter: 'none'` l'évite.
			script: bun,
			args: 'apps/server/src/index.ts',
			interpreter: 'none',
			cwd: __dirname,

			// Un seul process, impérativement : l'état des rooms (runtimes,
			// files d'attente, permissions en attente, sockets) est en mémoire.
			// Le mode cluster répartirait les requêtes entre des process qui ne
			// partagent rien — les pannes seraient intermittentes et illisibles.
			exec_mode: 'fork',
			instances: 1,

			autorestart: true,
			watch: false,

			// Un plantage au boot (migration absente, binaire claude introuvable)
			// ne doit pas partir en boucle de redémarrage.
			min_uptime: '20s',
			max_restarts: 10,
			restart_delay: 3000,

			// Chaque room lance un process `claude` enfant, plus gourmand que le
			// serveur lui-même. PM2 ne mesure que le parent : un seuil bas ne
			// ferait que redémarrer le serveur sans traiter la vraie cause.
			max_memory_restart: '1G',

			// SIGINT déclenche disposeAll(), qui arrête les process claude enfants.
			// Trop court, ils seraient orphelins après un SIGKILL de PM2.
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
