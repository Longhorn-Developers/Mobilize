PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_avoidance_areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`boundary_geojson` text NOT NULL,
	`images` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_avoidance_areas`("id", "user_id", "name", "description", "boundary_geojson", "images", "created_at", "updated_at") SELECT "id", "user_id", "name", "description", "boundary_geojson", "images", "created_at", "updated_at" FROM `avoidance_areas`;--> statement-breakpoint
DROP TABLE `avoidance_areas`;--> statement-breakpoint
ALTER TABLE `__new_avoidance_areas` RENAME TO `avoidance_areas`;--> statement-breakpoint
PRAGMA foreign_keys=ON;