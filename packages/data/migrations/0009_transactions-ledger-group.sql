ALTER TABLE "asset_transactions" ADD COLUMN "ledger_group_id" uuid;--> statement-breakpoint
ALTER TABLE "security_transactions" ADD COLUMN "ledger_group_id" uuid;--> statement-breakpoint
CREATE INDEX "asset_transactions_asset_id_ledger_group_id_idx" ON "asset_transactions" USING btree ("asset_id","ledger_group_id");--> statement-breakpoint
CREATE INDEX "security_transactions_asset_security_id_ledger_group_id_idx" ON "security_transactions" USING btree ("asset_security_id","ledger_group_id");