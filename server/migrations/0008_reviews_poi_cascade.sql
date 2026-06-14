-- Add ON DELETE CASCADE to reviews.poi_id so that deleting a POI also removes its reviews.
-- SQLite does not support ALTER TABLE DROP CONSTRAINT, so we recreate the table.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `reviews_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`features` text,
	`content` text,
	`poi_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`poi_id`) REFERENCES `pois`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `reviews_new` SELECT * FROM `reviews`;
--> statement-breakpoint
DROP INDEX IF EXISTS `poi_deleted_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `reviews_user_poi_deleted_idx`;
--> statement-breakpoint
DROP TABLE `reviews`;
--> statement-breakpoint
ALTER TABLE `reviews_new` RENAME TO `reviews`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `poi_deleted_idx` ON `reviews` (`poi_id`,`deleted_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reviews_user_poi_deleted_idx` ON `reviews` (`user_id`,`poi_id`,`deleted_at`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
