ALTER TABLE "asset_transactions" ALTER COLUMN "value" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "asset_transactions" ALTER COLUMN "currency_value" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "asset_transactions" ALTER COLUMN "fees" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "asset_values" ALTER COLUMN "value" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "recurring_contributions" ALTER COLUMN "amount" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "security_transactions" ALTER COLUMN "value" SET DATA TYPE numeric(18, 8);--> statement-breakpoint
ALTER TABLE "security_transactions" ALTER COLUMN "currency_value" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "security_transactions" ALTER COLUMN "fees" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "user_asset_securities" ALTER COLUMN "prior_gain_loss" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "milestones" ALTER COLUMN "target_value" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "fire_settings" ALTER COLUMN "annual_income_goal" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "fire_settings" ALTER COLUMN "expected_annual_return" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "fire_settings" ALTER COLUMN "safe_withdrawal_rate" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "fire_settings" ALTER COLUMN "monthly_investment" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "net_worth" SET DATA TYPE numeric(18, 4);