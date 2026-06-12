CREATE TYPE "public"."security_transaction_source" AS ENUM('manual', 'recurring', 'ocr', 'import');--> statement-breakpoint
ALTER TYPE "public"."asset_transaction_source" ADD VALUE 'dividend';--> statement-breakpoint
ALTER TYPE "public"."asset_transaction_source" ADD VALUE 'sipp-rebate';--> statement-breakpoint
ALTER TYPE "public"."asset_transaction_source" ADD VALUE 'cash-top-up';--> statement-breakpoint
ALTER TYPE "public"."asset_transaction_source" ADD VALUE 'cash-withdrawal';--> statement-breakpoint
ALTER TABLE "security_transactions" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "security_transactions" ALTER COLUMN "source" SET DATA TYPE security_transaction_source USING source::text::security_transaction_source;--> statement-breakpoint
ALTER TABLE "security_transactions" ALTER COLUMN "source" SET DEFAULT 'manual';--> statement-breakpoint