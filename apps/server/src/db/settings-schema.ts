import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Réglages modifiés depuis l'interface d'administration. Table clé/valeur :
 * une ligne par réglage renseigné, l'absence signifiant « garde le `.env` ».
 */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: integer('updated_at').notNull(),
})
