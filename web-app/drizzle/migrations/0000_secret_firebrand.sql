CREATE TABLE `skill_stars` (
	`skill_id` text PRIMARY KEY NOT NULL,
	`star_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
