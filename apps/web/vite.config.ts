import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const target = process.env.SERVER_URL ?? 'http://localhost:3001'

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 5173,
		proxy: {
			'/api': { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
			'/ws': { target, ws: true },
		},
	},
})
