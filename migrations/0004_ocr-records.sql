CREATE TABLE "ocr_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid,
	"process_id" uuid,
	"platform_key" text NOT NULL,
	"status" "process_status" NOT NULL,
	"extracted_values" jsonb,
	"pipeline" jsonb,
	"error" text,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "ocr_jobs_status_completed_or_failed_or_aborted_has_completed_at" CHECK (("ocr_jobs"."status" in ('completed', 'failed', 'aborted') and "ocr_jobs"."completed_at" is not null) or ("ocr_jobs"."status" not in ('completed', 'failed', 'aborted') and "ocr_jobs"."completed_at" is null))
);
--> statement-breakpoint
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ocr_jobs_document_id_idx" ON "ocr_jobs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "ocr_jobs_process_id_idx" ON "ocr_jobs" USING btree ("process_id");