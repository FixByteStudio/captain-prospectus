CREATE TABLE `import_batches` (
	`import_id` text NOT NULL,
	`batch_index` integer NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`received_at` integer NOT NULL,
	PRIMARY KEY(`import_id`, `batch_index`)
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`file_name` text,
	`zone_vertices` integer,
	`zone_radius_m` integer,
	`rejected` integer NOT NULL,
	`batch_count` integer NOT NULL,
	`created_by` text,
	`started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `imports_started_idx` ON `imports` (`started_at`);