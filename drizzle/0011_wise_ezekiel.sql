CREATE TABLE `login_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `login_codes_user_email_idx` ON `login_codes` (`user_email`);