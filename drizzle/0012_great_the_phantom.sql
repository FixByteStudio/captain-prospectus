ALTER TABLE `sessions` ADD `id` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `device_label` text;--> statement-breakpoint
UPDATE `sessions` SET `id` = lower(hex(randomblob(16))) WHERE `id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_id_idx` ON `sessions` (`id`);
