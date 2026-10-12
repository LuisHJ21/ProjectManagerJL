CREATE TABLE `project_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_groups_name_unique` ON `project_groups` (`name`);--> statement-breakpoint
CREATE TABLE `stages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stakeholders` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`organization` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`raci` text DEFAULT 'I' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_assignees` (
	`task_id` text NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_reschedules` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`old_start` text,
	`old_end` text,
	`new_start` text,
	`new_end` text,
	`reason` text NOT NULL,
	`changed_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `scope` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `risks` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `budget` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `currency` text DEFAULT 'PEN' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `group_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `kind` text DEFAULT 'activity' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `stage_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `progress` integer DEFAULT 0 NOT NULL;