ALTER TABLE "asset_values" ADD COLUMN "value_date" timestamp;--> statement-breakpoint
UPDATE "asset_values" SET "value_date" = "recorded_at" WHERE "value_date" IS NULL;--> statement-breakpoint
ALTER TABLE "asset_values" ALTER COLUMN "value_date" SET NOT NULL;--> statement-breakpoint