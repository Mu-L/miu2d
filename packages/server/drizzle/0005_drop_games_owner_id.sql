ALTER TABLE "games" DROP CONSTRAINT "games_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "owner_id";