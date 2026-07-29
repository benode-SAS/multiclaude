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
			script: 'apps/server/src/index.ts',
			cwd: __dirname,

			// PM2 lance node par défaut. `which bun` puis BUN_BIN=/chemin/bun si
			// le PATH de PM2 ne le trouve pas (fréquent en démarrage au boot).
			interpreter: process.env.BUN_BIN || 'bun',

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
			wait_ready: false,

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
