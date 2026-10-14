CREATE TABLE `tournee_stops` (
	`id` text PRIMARY KEY NOT NULL,
	`tournee_id` text NOT NULL,
	`prospect_id` text NOT NULL,
	`number` integer NOT NULL,
	`added_at` integer NOT NULL,
	`client_added_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	FOREIGN KEY (`tournee_id`) REFERENCES `tournees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournee_stops_tournee_prospect_idx` ON `tournee_stops` (`tournee_id`,`prospect_id`);--> statement-breakpoint
CREATE INDEX `tournee_stops_prospect_idx` ON `tournee_stops` (`prospect_id`);--> statement-breakpoint
CREATE TABLE `tournees` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_email` text NOT NULL,
	`day_start` integer NOT NULL,
	`started_at` integer NOT NULL,
	`client_started_at` integer NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournees_agent_day_idx` ON `tournees` (`agent_email`,`day_start`);