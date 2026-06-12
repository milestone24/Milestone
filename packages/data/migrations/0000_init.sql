CREATE TYPE "public"."recurring_contribution_process_type" AS ENUM('automatic', 'manual');--> statement-breakpoint
CREATE TYPE "public"."recurring_contribution_type" AS ENUM('asset', 'security');--> statement-breakpoint
CREATE TYPE "public"."schedule_pattern_type" AS ENUM('cron', 'rrule');--> statement-breakpoint
CREATE TYPE "public"."value_entry_method" AS ENUM('manual', 'calculated');--> statement-breakpoint
CREATE TYPE "public"."value_method" AS ENUM('manual', 'calculated');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('employed', 'self-employed', 'unemployed', 'retired', 'student', 'other');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."income_level" AS ENUM('low', 'medium', 'high', 'other');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('single', 'married', 'divorced', 'widowed');--> statement-breakpoint
CREATE TYPE "public"."api_key_scope" AS ENUM('read', 'write', 'admin', 'trigger');--> statement-breakpoint
CREATE TYPE "public"."api_key_type" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "public"."process_status" AS ENUM('pending', 'running', 'completed', 'failed', 'aborted');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('ISA', 'SIPP', 'LISA', 'GIA', 'OTHER');--> statement-breakpoint
CREATE TABLE "asset_transactions" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"currency_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"fees" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"value_date" timestamp NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "asset_values" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"value_date" timestamp NOT NULL,
	"entry_method" "value_entry_method" DEFAULT 'manual' NOT NULL,
	"asset_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "broker_platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"supports_api_key" boolean DEFAULT false NOT NULL,
	"supported_account_types" "account_type"[] NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "broker_platforms_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "broker_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"supports_api_key" boolean DEFAULT false NOT NULL,
	"supported_account_types" "account_type"[] NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "broker_providers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "recurring_contributions" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"type" "recurring_contribution_type" NOT NULL,
	"process_type" "recurring_contribution_process_type" NOT NULL,
	"asset_id" uuid NOT NULL,
	"security_id" uuid,
	"amount" numeric(18, 2) NOT NULL,
	"start_date" timestamp NOT NULL,
	"pattern_config" jsonb NOT NULL,
	"last_processed_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"notification_email" boolean DEFAULT false NOT NULL,
	"notification_push" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "security_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_security_id" uuid NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"currency_value" numeric(18, 2) NOT NULL,
	"fees" numeric(18, 2) DEFAULT '0',
	"currency" text DEFAULT 'GBP' NOT NULL,
	"value_date" timestamp NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_asset_api_key_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_asset_id" uuid NOT NULL,
	"api_key" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_asset_securities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_asset_id" uuid NOT NULL,
	"security_id" uuid NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"prior_gain_loss" numeric(18, 2),
	"start_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"value_method" "value_method" DEFAULT 'calculated' NOT NULL,
	"user_account_id" uuid NOT NULL,
	"platform_id" uuid,
	"provider_id" uuid,
	"account_type" "account_type" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "user_assets_name_user_account_id_unique" UNIQUE("name","user_account_id")
);
--> statement-breakpoint
CREATE TABLE "securities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sourceIdentifier" text NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"exchange" text,
	"country" text,
	"currency" text,
	"type" text,
	"isin" text,
	"cusip" text,
	"figi" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "security_daily_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"security_id" uuid NOT NULL,
	"date" date NOT NULL,
	"open" numeric(10, 4),
	"high" numeric(10, 4),
	"low" numeric(10, 4),
	"close" numeric(10, 4),
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "unique_security_date" UNIQUE("security_id","date")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_value" numeric(18, 2) NOT NULL,
	"account_type" text,
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "fire_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_account_id" uuid NOT NULL,
	"target_retirement_age" integer NOT NULL,
	"annual_income_goal" numeric(18, 2) NOT NULL,
	"expected_annual_return" numeric(18, 2) NOT NULL,
	"safe_withdrawal_rate" numeric(18, 2) NOT NULL,
	"monthly_investment" numeric(18, 2) NOT NULL,
	"adjust_inflation" boolean DEFAULT true NOT NULL,
	"include_state_pension" boolean DEFAULT false NOT NULL,
	"income_goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "core_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_account_id" uuid NOT NULL,
	"token" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "password_change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_account_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"changed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_account_id" uuid NOT NULL,
	"token" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "phone_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_account_id" uuid NOT NULL,
	"token" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" text NOT NULL,
	"parent_token_hash" text,
	"device_info" text,
	"last_used_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_account_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_account_id" uuid NOT NULL,
	"user_asset_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"core_user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"phone_number" text,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"is_phone_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "user_accounts_email_unique" UNIQUE("email"),
	CONSTRAINT "user_accounts_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_account_id" uuid NOT NULL,
	"avatar_url" text,
	"dob" date,
	"country_origin" text,
	"country_residence" text,
	"gender" "gender",
	"marital_status" "marital_status",
	"employment_status" "employment_status",
	"income_level" "income_level",
	"net_worth" numeric(18, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_account_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"name" text NOT NULL,
	"type" "api_key_type" NOT NULL,
	"scope" "api_key_scope" DEFAULT 'read' NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_account_id" uuid,
	"allowed_ips" text[],
	"allowed_domains" text[],
	"rate_limit" integer DEFAULT 60,
	"expires_at" timestamp,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"status" "process_status" NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"superseded_by" uuid,
	"payload" jsonb NOT NULL,
	"results" jsonb,
	"references" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "status_completed_or_failed_or_aborted_has_completed_at" CHECK (("processes"."status" in ('completed', 'failed', 'aborted') and "processes"."completed_at" is not null) or ("processes"."status" not in ('completed', 'failed', 'aborted') and "processes"."completed_at" is null))
);
--> statement-breakpoint
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_asset_id_user_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."user_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_contributions" ADD CONSTRAINT "recurring_contributions_asset_id_user_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."user_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_contributions" ADD CONSTRAINT "recurring_contributions_security_id_user_asset_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."user_asset_securities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_transactions" ADD CONSTRAINT "security_transactions_asset_security_id_user_asset_securities_id_fk" FOREIGN KEY ("asset_security_id") REFERENCES "public"."user_asset_securities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_asset_api_key_connections" ADD CONSTRAINT "user_asset_api_key_connections_user_asset_id_user_assets_id_fk" FOREIGN KEY ("user_asset_id") REFERENCES "public"."user_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_asset_securities" ADD CONSTRAINT "user_asset_securities_user_asset_id_user_assets_id_fk" FOREIGN KEY ("user_asset_id") REFERENCES "public"."user_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_asset_securities" ADD CONSTRAINT "user_asset_securities_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assets" ADD CONSTRAINT "user_assets_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assets" ADD CONSTRAINT "user_assets_platform_id_broker_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."broker_platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assets" ADD CONSTRAINT "user_assets_provider_id_broker_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."broker_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_daily_history" ADD CONSTRAINT "security_daily_history_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_settings" ADD CONSTRAINT "fire_settings_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_change_history" ADD CONSTRAINT "password_change_history_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenant_id_core_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_account_assets" ADD CONSTRAINT "user_account_assets_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_account_assets" ADD CONSTRAINT "user_account_assets_user_asset_id_user_assets_id_fk" FOREIGN KEY ("user_asset_id") REFERENCES "public"."user_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_core_user_id_core_users_id_fk" FOREIGN KEY ("core_user_id") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_core_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."core_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_superseded_by_processes_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "public"."processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_transactions_value_date_idx" ON "asset_transactions" USING btree ("value_date");--> statement-breakpoint
CREATE INDEX "security_transactions_asset_security_id_idx" ON "security_transactions" USING btree ("asset_security_id");--> statement-breakpoint
CREATE INDEX "security_transactions_value_date_idx" ON "security_transactions" USING btree ("value_date");--> statement-breakpoint
CREATE INDEX "security_transactions_recorded_at_idx" ON "security_transactions" USING btree ("value_date");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "api_keys_user_account_id_idx" ON "api_keys" USING btree ("user_account_id");--> statement-breakpoint
CREATE INDEX "api_keys_type_idx" ON "api_keys" USING btree ("type");