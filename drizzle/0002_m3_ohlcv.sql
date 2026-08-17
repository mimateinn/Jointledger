CREATE TABLE "ohlcv_bars" (
	"td_symbol" text NOT NULL,
	"td_exchange" text DEFAULT '' NOT NULL,
	"bar_date" date NOT NULL,
	"open" numeric(20, 8) NOT NULL,
	"high" numeric(20, 8) NOT NULL,
	"low" numeric(20, 8) NOT NULL,
	"close" numeric(20, 8) NOT NULL,
	"volume" numeric(20, 8) NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ohlcv_bars_td_symbol_td_exchange_bar_date_pk" PRIMARY KEY("td_symbol","td_exchange","bar_date")
);
--> statement-breakpoint
CREATE TABLE "ohlcv_fetch_state" (
	"td_symbol" text NOT NULL,
	"td_exchange" text DEFAULT '' NOT NULL,
	"last_fetch_utc_date" text,
	"last_status" text NOT NULL,
	"last_attempt_at" timestamp with time zone,
	CONSTRAINT "ohlcv_fetch_state_td_symbol_td_exchange_pk" PRIMARY KEY("td_symbol","td_exchange")
);
