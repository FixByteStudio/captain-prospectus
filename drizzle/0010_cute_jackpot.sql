CREATE TABLE `login_attempts` (
	`ip_hash` text NOT NULL,
	`window_start` integer NOT NULL,
	`failures` integer NOT NULL,
	PRIMARY KEY(`ip_hash`, `window_start`)
);
