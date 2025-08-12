CREATE TABLE "broker_platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"supports_api_key" boolean DEFAULT false NOT NULL,
	"supported_account_types" "account_type"[] NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "broker_platforms_name_unique" UNIQUE("name")
);

INSERT INTO "broker_platforms" ("id", "name", "supports_api_key", "supported_account_types", "created_at", "updated_at") VALUES
  (gen_random_uuid(), 'Trading 212', false, ARRAY['ISA','CISA','SIPP','GIA']::account_type[], now(), now()),
  (gen_random_uuid(), 'Vanguard', false, ARRAY['ISA','CISA','SIPP','GIA']::account_type[], now(), now()),
  (gen_random_uuid(), 'InvestEngine', false, ARRAY['ISA','CISA','SIPP','GIA']::account_type[], now(), now()),
  (gen_random_uuid(), 'Hargreaves Lansdown', false, ARRAY['ISA','CISA','SIPP','LISA','GIA']::account_type[], now(), now()),
  (gen_random_uuid(), 'AJ Bell', false, ARRAY['ISA','CISA','SIPP','LISA','GIA']::account_type[], now(), now())
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "broker_provider_assets" ALTER COLUMN "provider_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "broker_provider_assets" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
UPDATE "broker_provider_assets" SET "start_date" = "created_at" WHERE "start_date" IS NULL;--> statement-breakpoint
ALTER TABLE "broker_provider_assets" ALTER COLUMN "start_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "broker_provider_assets" ADD COLUMN "control" text DEFAULT 'automatic' NOT NULL;--> statement-breakpoint
ALTER TABLE "broker_provider_assets" ADD COLUMN "platform_id" uuid;--> statement-breakpoint
ALTER TABLE "broker_provider_assets" ADD CONSTRAINT "broker_provider_assets_platform_id_broker_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."broker_platforms"("id") ON DELETE no action ON UPDATE no action;