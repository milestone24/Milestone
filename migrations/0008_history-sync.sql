CREATE TYPE "public"."entry_method" AS ENUM('manual', 'calculated');--> statement-breakpoint
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
ALTER TABLE "asset_values" ADD COLUMN "entry_method" "entry_method" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_values" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "broker_provider_asset_securities" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
UPDATE "broker_provider_asset_securities" SET "start_date" = "recorded_at" WHERE "start_date" IS NULL;--> statement-breakpoint
ALTER TABLE "broker_provider_asset_securities" ALTER COLUMN "start_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "security_daily_history" ADD CONSTRAINT "security_daily_history_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE no action ON UPDATE no action;