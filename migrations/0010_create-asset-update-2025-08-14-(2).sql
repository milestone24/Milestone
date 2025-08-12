CREATE TYPE "public"."value_method" AS ENUM('manual', 'calculated');--> statement-breakpoint
ALTER TYPE "public"."entry_method" RENAME TO "value_entry_method";--> statement-breakpoint
ALTER TABLE "broker_provider_assets" RENAME COLUMN "control" TO "value_method";