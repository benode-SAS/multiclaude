import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const root = path.resolve(import.meta.dirname, '../..')

export default defineConfig(({ mode }) => {
	// '' prefix: read every key, not just VITE_*
	const env = { ...loadEnv(mode, root, ''), ...process.env }
	const target = env.API_URL ?? `http://localhost:${env.PORT ?? 3001}`

	return {
		plugins: [react(), tailwindcss()],
		envDir: root,
		server: {
			port: Number(env.WEB_PORT ?? 5173),
			host: env.WEB_HOST ?? 'localhost',
			proxy: {
				'/api': { target, changeOrigin: true },
				'/ws': { target, ws: true },
			},
		},
	}
})
