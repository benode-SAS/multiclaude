-- Plain ADD COLUMN, deliberately not the table recreation drizzle-kit generates:
-- `PRAGMA foreign_keys=OFF` is a no-op inside a transaction, and the migrator opens
-- one, so dropping `rooms` cascades and erases every message, event and attachment.
ALTER TABLE `rooms` ADD COLUMN `archived_at` integer;
