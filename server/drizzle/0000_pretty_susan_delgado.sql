CREATE TABLE IF NOT EXISTS `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text,
	`project_id` text,
	`task_id` text,
	`action` text NOT NULL,
	`details_json` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`parent_id` text,
	`name` text NOT NULL,
	`agent_type` text NOT NULL,
	`role` text NOT NULL,
	`department` text,
	`status` text DEFAULT 'inactive',
	`model_tier` text DEFAULT 'medium',
	`emoji` text,
	`persona_json` text,
	`skills_json` text,
	`config_json` text,
	`sprite_key` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_agents_project_name` ON `agents` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active',
	`priority` text DEFAULT 'medium',
	`config_json` text,
	`scene_config` text,
	`cwd` text,
	`source` text DEFAULT 'manual',
	`last_synced_at` text,
	`sync_hash` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `projects_name_unique` ON `projects` (`name`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `saved_agent_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`agent_type` text NOT NULL,
	`role` text NOT NULL,
	`department` text,
	`model_tier` text DEFAULT 'medium',
	`persona_json` text,
	`skills_json` text,
	`config_json` text,
	`source_agent_id` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`source_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`agent_id` text,
	`workflow_id` text,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending',
	`priority` text DEFAULT 'medium',
	`input_json` text,
	`output_json` text,
	`error_json` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`steps_json` text NOT NULL,
	`estimated_time` text,
	`status` text DEFAULT 'idle',
	`current_step` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_workflows_project_name` ON `workflows` (`project_id`,`name`);