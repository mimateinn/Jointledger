CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL UNIQUE,
	"email" text UNIQUE,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id"),
	"token_hash" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"trade_currency" text DEFAULT 'USD' NOT NULL,
	"deposit_currency" text DEFAULT 'HKD' NOT NULL,
	"created_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL REFERENCES "books"("id"),
	"user_id" uuid REFERENCES "users"("id"),
	"display_name" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL REFERENCES "books"("id"),
	"member_id" uuid REFERENCES "members"("id"),
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "allocation_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL REFERENCES "books"("id"),
	"effective_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "allocation_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL REFERENCES "allocation_schedules"("id"),
	"member_id" uuid NOT NULL REFERENCES "members"("id"),
	"percent" numeric(20, 8) NOT NULL
);

CREATE TABLE "cash_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL REFERENCES "books"("id"),
	"member_id" uuid NOT NULL REFERENCES "members"("id"),
	"ledger_account_id" uuid NOT NULL REFERENCES "ledger_accounts"("id"),
	"kind" text NOT NULL,
	"amount_hkd" numeric(20, 8) NOT NULL,
	"fx_rate" numeric(20, 8) NOT NULL,
	"amount_usd" numeric(20, 8) NOT NULL,
	"occurred_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL REFERENCES "books"("id"),
	"ledger_account_id" uuid NOT NULL REFERENCES "ledger_accounts"("id"),
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"fee_usd" numeric(20, 8) DEFAULT '0' NOT NULL,
	"occurred_on" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trade_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL REFERENCES "trades"("id"),
	"member_id" uuid NOT NULL REFERENCES "members"("id"),
	"quantity" numeric(20, 8) NOT NULL,
	"cost_usd" numeric(20, 8) DEFAULT '0' NOT NULL,
	"proceeds_usd" numeric(20, 8) DEFAULT '0' NOT NULL
);
