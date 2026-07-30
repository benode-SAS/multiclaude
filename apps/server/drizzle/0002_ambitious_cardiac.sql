CREATE TABLE `drafts` (
	`room_id` text NOT NULL,
	`pseudo` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `pseudo`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
