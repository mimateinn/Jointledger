CREATE TABLE "watch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"display_code" text NOT NULL,
	"muted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_items_book_code" UNIQUE("book_id","display_code")
);
--> statement-breakpoint
CREATE TABLE "news_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watch_items" ADD CONSTRAINT "watch_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;
