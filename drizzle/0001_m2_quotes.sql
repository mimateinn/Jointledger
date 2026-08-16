CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_code" text NOT NULL,
	"display_name" text,
	"asset_class" text NOT NULL,
	"market" text NOT NULL,
	"td_symbol" text NOT NULL,
	"td_exchange" text,
	"is_etf_proxy" boolean DEFAULT false NOT NULL,
	"tape_slot" integer,
	"plan_hint" boolean DEFAULT false NOT NULL,
	CONSTRAINT "instruments_display_code_unique" UNIQUE("display_code")
);
--> statement-breakpoint
CREATE TABLE "quote_refresh_state" (
	"id" text PRIMARY KEY NOT NULL,
	"last_pack_at" timestamp with time zone,
	"rate_limited_until" timestamp with time zone,
	"credit_utc_date" text,
	"credits_used" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"instrument_id" uuid PRIMARY KEY NOT NULL,
	"last" numeric(20, 8),
	"percent_change" numeric(20, 8),
	"previous_close" numeric(20, 8),
	"quoted_at" timestamp with time zone,
	"fetched_at" timestamp with time zone NOT NULL,
	"delay_seconds" integer DEFAULT 900 NOT NULL,
	"status" text NOT NULL,
	"source" text DEFAULT 'twelve_data' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;