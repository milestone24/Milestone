CREATE TABLE "broker_platform_securities_ocr_context_instructions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_platform_id" uuid NOT NULL,
	"instruction_text" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "broker_platform_securities_ocr_context_instructions" ADD CONSTRAINT "broker_platform_securities_ocr_context_instructions_broker_platform_id_broker_platforms_id_fk" FOREIGN KEY ("broker_platform_id") REFERENCES "public"."broker_platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bp_securities_ocr_ctx_instr_platform_idx" ON "broker_platform_securities_ocr_context_instructions" USING btree ("broker_platform_id");