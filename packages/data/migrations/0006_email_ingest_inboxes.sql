CREATE TYPE "public"."email_ingest_event_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."email_ingest_inbox_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "email_ingest_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"s3_bucket" text NOT NULL,
	"s3_key" text NOT NULL,
	"content_sha256" text NOT NULL,
	"rfc5322_message_id" text,
	"status" "email_ingest_event_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"email_ingest_inbox_id" uuid,
	"document_id" uuid,
	"process_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "email_ingest_events_s3_bucket_s3_key_unique" UNIQUE("s3_bucket","s3_key")
);
--> statement-breakpoint
CREATE TABLE "email_ingest_inboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_account_id" uuid NOT NULL,
	"short_code" text NOT NULL,
	"platform_key" text,
	"allowed_senders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "email_ingest_inbox_status" DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp,
	"replaced_by_inbox_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "email_ingest_events" ADD CONSTRAINT "email_ingest_events_email_ingest_inbox_id_email_ingest_inboxes_id_fk" FOREIGN KEY ("email_ingest_inbox_id") REFERENCES "public"."email_ingest_inboxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_ingest_events" ADD CONSTRAINT "email_ingest_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_ingest_events" ADD CONSTRAINT "email_ingest_events_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_ingest_inboxes" ADD CONSTRAINT "email_ingest_inboxes_user_account_id_user_accounts_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_ingest_inboxes" ADD CONSTRAINT "email_ingest_inboxes_replaced_by_inbox_id_email_ingest_inboxes_id_fk" FOREIGN KEY ("replaced_by_inbox_id") REFERENCES "public"."email_ingest_inboxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_ingest_events_email_ingest_inbox_id_idx" ON "email_ingest_events" USING btree ("email_ingest_inbox_id");--> statement-breakpoint
CREATE INDEX "email_ingest_events_document_id_idx" ON "email_ingest_events" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "email_ingest_events_process_id_idx" ON "email_ingest_events" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "email_ingest_events_content_sha256_idx" ON "email_ingest_events" USING btree ("content_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "email_ingest_inboxes_short_code_active_unique" ON "email_ingest_inboxes" USING btree ("short_code") WHERE "email_ingest_inboxes"."status" = 'active';--> statement-breakpoint
CREATE INDEX "email_ingest_inboxes_user_account_id_idx" ON "email_ingest_inboxes" USING btree ("user_account_id");