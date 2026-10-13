PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text NOT NULL,
	`device_label` text,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("token_hash", "user_email", "created_at", "last_seen_at", "expires_at", "id", "device_label") SELECT "token_hash", "user_email", "created_at", "last_seen_at", "expires_at", "id", "device_label" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sessions_user_email_idx` ON `sessions` (`user_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_id_idx` ON `sessions` (`id`);