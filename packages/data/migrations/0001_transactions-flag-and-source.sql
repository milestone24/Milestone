CREATE TYPE "public"."asset_transaction_source" AS ENUM('manual', 'recurring', 'ocr', 'import');--> statement-breakpoint
ALTER TABLE "asset_transactions" ADD COLUMN "source" "asset_transaction_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_transactions" ADD COLUMN "flags" jsonb;--> statement-breakpoint
ALTER TABLE "security_transactions" ADD COLUMN "source" "asset_transaction_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "security_transactions" ADD COLUMN "flags" jsonb;