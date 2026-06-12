CREATE TYPE "public"."ocr_job_review_state" AS ENUM('pending_review', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "ocr_job_security_transactions" (
	"ocr_job_id" uuid NOT NULL,
	"security_transaction_id" uuid NOT NULL,
	CONSTRAINT "ocr_job_security_transactions_ocr_job_id_security_transaction_id_pk" PRIMARY KEY("ocr_job_id","security_transaction_id")
);
--> statement-breakpoint
ALTER TABLE "ocr_jobs" ADD COLUMN "review_state" "ocr_job_review_state";--> statement-breakpoint
ALTER TABLE "ocr_job_security_transactions" ADD CONSTRAINT "ocr_job_security_transactions_ocr_job_id_ocr_jobs_id_fk" FOREIGN KEY ("ocr_job_id") REFERENCES "public"."ocr_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_job_security_transactions" ADD CONSTRAINT "ocr_job_security_transactions_security_transaction_id_security_transactions_id_fk" FOREIGN KEY ("security_transaction_id") REFERENCES "public"."security_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ocr_job_security_transactions_ocr_job_id_idx" ON "ocr_job_security_transactions" USING btree ("ocr_job_id");