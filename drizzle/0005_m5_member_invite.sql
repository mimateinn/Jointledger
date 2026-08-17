ALTER TABLE "members" ADD COLUMN "invite_secret_hash" text;
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "invite_expires_at" timestamp with time zone;
