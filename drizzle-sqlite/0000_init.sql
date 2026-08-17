CREATE TABLE `allocation_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`member_id` text NOT NULL,
	`percent` text NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `allocation_schedules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `allocation_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`effective_on` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`trade_currency` text DEFAULT 'USD' NOT NULL,
	`deposit_currency` text DEFAULT 'HKD' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cash_flows` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`member_id` text NOT NULL,
	`ledger_account_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_hkd` text NOT NULL,
	`fx_rate` text NOT NULL,
	`amount_usd` text NOT NULL,
	`occurred_on` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ledger_account_id`) REFERENCES `ledger_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text,
	`created_by_user_id` text NOT NULL,
	`filename` text NOT NULL,
	`file_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`cash_flow_count` integer DEFAULT 0 NOT NULL,
	`trade_count` integer DEFAULT 0 NOT NULL,
	`warning_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`mode` text DEFAULT 'initial' NOT NULL,
	`plan` text,
	`row_log` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`display_code` text NOT NULL,
	`display_name` text,
	`asset_class` text NOT NULL,
	`market` text NOT NULL,
	`td_symbol` text NOT NULL,
	`td_exchange` text,
	`is_etf_proxy` integer DEFAULT false NOT NULL,
	`tape_slot` integer,
	`plan_hint` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instruments_display_code_unique` ON `instruments` (`display_code`);--> statement-breakpoint
CREATE TABLE `ledger_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`member_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`user_id` text,
	`display_name` text NOT NULL,
	`email` text,
	`invite_secret_hash` text,
	`invite_expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `news_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ohlcv_bars` (
	`td_symbol` text NOT NULL,
	`td_exchange` text DEFAULT '' NOT NULL,
	`bar_date` text NOT NULL,
	`open` text NOT NULL,
	`high` text NOT NULL,
	`low` text NOT NULL,
	`close` text NOT NULL,
	`volume` text NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`td_symbol`, `td_exchange`, `bar_date`)
);
--> statement-breakpoint
CREATE TABLE `ohlcv_fetch_state` (
	`td_symbol` text NOT NULL,
	`td_exchange` text DEFAULT '' NOT NULL,
	`last_fetch_utc_date` text,
	`last_status` text NOT NULL,
	`last_attempt_at` integer,
	PRIMARY KEY(`td_symbol`, `td_exchange`)
);
--> statement-breakpoint
CREATE TABLE `quote_refresh_state` (
	`id` text PRIMARY KEY NOT NULL,
	`last_pack_at` integer,
	`rate_limited_until` integer,
	`credit_utc_date` text,
	`credits_used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`instrument_id` text PRIMARY KEY NOT NULL,
	`last` text,
	`percent_change` text,
	`previous_close` text,
	`quoted_at` integer,
	`fetched_at` integer NOT NULL,
	`delay_seconds` integer DEFAULT 900 NOT NULL,
	`status` text NOT NULL,
	`source` text DEFAULT 'twelve_data' NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `trade_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`trade_id` text NOT NULL,
	`member_id` text NOT NULL,
	`quantity` text NOT NULL,
	`cost_usd` text DEFAULT '0' NOT NULL,
	`proceeds_usd` text DEFAULT '0' NOT NULL,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`ledger_account_id` text NOT NULL,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`quantity` text NOT NULL,
	`price` text NOT NULL,
	`fee_usd` text DEFAULT '0' NOT NULL,
	`occurred_on` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ledger_account_id`) REFERENCES `ledger_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`password_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_display_name_unique` ON `users` (`display_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `watch_items` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`display_code` text NOT NULL,
	`muted` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watch_items_book_code` ON `watch_items` (`book_id`,`display_code`);