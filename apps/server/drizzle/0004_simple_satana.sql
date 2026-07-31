ALTER TABLE `rooms` ADD `forked_from` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `fork_pending` integer DEFAULT false NOT NULL;