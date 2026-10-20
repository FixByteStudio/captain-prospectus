ALTER TABLE `visits` ADD `repaired_at` integer;--> statement-breakpoint
CREATE INDEX `visits_listed_idx` ON `visits` (coalesce("repaired_at", "received_at"));
