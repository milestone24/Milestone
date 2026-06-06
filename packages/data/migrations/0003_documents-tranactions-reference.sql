CREATE TABLE "asset_transaction_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_transaction_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "asset_transaction_documents_unique" UNIQUE("asset_transaction_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "security_transaction_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"security_transaction_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "security_transaction_documents_unique" UNIQUE("security_transaction_id","document_id")
);
--> statement-breakpoint
ALTER TABLE "asset_transactions" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "asset_transaction_documents" ADD CONSTRAINT "asset_transaction_documents_asset_transaction_id_asset_transactions_id_fk" FOREIGN KEY ("asset_transaction_id") REFERENCES "public"."asset_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transaction_documents" ADD CONSTRAINT "asset_transaction_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_transaction_documents" ADD CONSTRAINT "security_transaction_documents_security_transaction_id_security_transactions_id_fk" FOREIGN KEY ("security_transaction_id") REFERENCES "public"."security_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_transaction_documents" ADD CONSTRAINT "security_transaction_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_transaction_documents_asset_transaction_id_idx" ON "asset_transaction_documents" USING btree ("asset_transaction_id");--> statement-breakpoint
CREATE INDEX "asset_transaction_documents_document_id_idx" ON "asset_transaction_documents" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "security_transaction_documents_security_transaction_id_idx" ON "security_transaction_documents" USING btree ("security_transaction_id");--> statement-breakpoint
CREATE INDEX "security_transaction_documents_document_id_idx" ON "security_transaction_documents" USING btree ("document_id");