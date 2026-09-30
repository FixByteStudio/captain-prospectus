ALTER TABLE `prospects` ADD `out_of_target_reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `visits` ADD `refusal_reason` text;--> statement-breakpoint
ALTER TABLE `visits_orphaned` ADD `refusal_reason` text;