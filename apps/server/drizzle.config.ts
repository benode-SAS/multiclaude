import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	dialect: 'sqlite',
	schema: ['./src/db/schema.ts', './src/db/auth-schema.ts', './src/db/settings-schema.ts'],
	out: './drizzle',
	dbCredentials: { url: '../../data/app.db' },
})
