import type { AdminSettings } from '@multiclaude/shared'
import { eq } from 'drizzle-orm'
import { config } from '../config.ts'
import { db } from '../db/index.ts'
import { settings } from '../db/settings-schema.ts'
import { now } from '../lib/ids.ts'

/**
 * Le `.env` donne la valeur de départ, l'administrateur peut la changer à
 * chaud. Un cache mémoire évite une requête à chaque inscription ou création
 * de room ; il n'y a qu'un process serveur, donc rien à invalider ailleurs.
 */
let cache: AdminSettings | null = null

const defaults = (): AdminSettings => ({
	signupEnabled: config.signupEnabled,
	defaultModel: null,
})

function load(): AdminSettings {
	if (cache) return cache
	const resolved = defaults()
	for (const row of db.select().from(settings).all()) {
		if (row.key === 'signupEnabled') resolved.signupEnabled = row.value === 'true'
		if (row.key === 'defaultModel') resolved.defaultModel = row.value || null
	}
	cache = resolved
	return resolved
}

function write(key: string, value: string) {
	db.insert(settings)
		.values({ key, value, updatedAt: now() })
		.onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now() } })
		.run()
}

export const SettingsService = {
	all: load,
	signupEnabled: () => load().signupEnabled,
	defaultModel: () => load().defaultModel,

	update(patch: Partial<AdminSettings>): AdminSettings {
		if (patch.signupEnabled !== undefined) write('signupEnabled', String(patch.signupEnabled))
		if (patch.defaultModel !== undefined) write('defaultModel', patch.defaultModel ?? '')
		cache = null
		return load()
	},

	/** Revient à ce que dit le `.env` en effaçant les surcharges. */
	reset(): AdminSettings {
		db.delete(settings).where(eq(settings.key, 'signupEnabled')).run()
		db.delete(settings).where(eq(settings.key, 'defaultModel')).run()
		cache = null
		return load()
	},
}
