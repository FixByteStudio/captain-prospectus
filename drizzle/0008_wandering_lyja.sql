CREATE TABLE `agent_positions` (
	`agent_email` text PRIMARY KEY NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`accuracy` real NOT NULL,
	`captured_at` integer NOT NULL,
	`received_at` integer NOT NULL
);
