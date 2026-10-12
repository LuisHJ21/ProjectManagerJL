CREATE TABLE `task_dependencies` (
	`task_id` text NOT NULL,
	`depends_on_id` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `estimate_value` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `estimate_unit` text DEFAULT 'hours' NOT NULL;