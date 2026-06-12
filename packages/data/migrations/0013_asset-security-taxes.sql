ALTER TABLE "security_transactions" ALTER COLUMN "per_unit_value" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "security_transactions" ADD COLUMN "taxes" numeric(18, 4) DEFAULT '0';