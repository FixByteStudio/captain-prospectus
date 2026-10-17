DROP INDEX `tournees_agent_day_idx`;--> statement-breakpoint
CREATE INDEX `tournees_agent_day_started_idx` ON `tournees` (`agent_email`,`day_start`,`client_started_at`,`id`);