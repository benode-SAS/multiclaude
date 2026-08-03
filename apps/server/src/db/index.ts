import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { config } from '../config.ts'
import * as authSchema from './auth-schema.ts'
import * as roomSchema from './schema.ts'
import * as settingsSchema from './settings-schema.ts'

const schema = { ...roomSchema, ...authSchema, ...settingsSchema }

const sqlite = new Database(config.dbPath, { create: true })
sqlite.exec('PRAGMA journal_mode = WAL;')
sqlite.exec('PRAGMA foreign_keys = ON;')

export const db = drizzle(sqlite, { schema })

export function runMigrations() {
	migrate(db, { migrationsFolder: config.migrationsDir })
}

export { schema }
