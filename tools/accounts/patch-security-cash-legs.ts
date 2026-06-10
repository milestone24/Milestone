/**
 * Backfill paired `asset_transactions` rows for existing `security_transactions` on one asset
 * (portfolio `user_assets` row). For each ungrouped security line, sets a cash leg with magnitude
 * `|security_transactions.currency_value|` and sign derived only from `security_transactions.value`:
 * **negative value = sell** → positive `currency_value` on the asset row (cash in);
 * **positive value = buy** → negative `currency_value` (cash out). Zero delta is skipped.
 * Sets matching `ledger_group_id` on both legs.
 *
 * Requires `DATABASE_URL` in the environment (same as running the server); this script does not load any env files.
 *
 * Usage:
 *   npx tsx tools/accounts/patch-security-cash-legs.ts --user-account-id <uuid> --asset-id <uuid>
 *   npx tsx tools/accounts/patch-security-cash-legs.ts ... --dry-run
 */
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { z } from "zod";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { createDatabaseConnection } from "@milestone/data";
import {
  assetTransactions,
  securityTransactions,
  userAssets,
  userAssetSecurities,
} from "@milestone/data/schema";
import {
  createDecimalValueString,
  type DecimalValueString,
} from "@milestone/js-common/schema";

const { db } = createDatabaseConnection();

const uuidSchema = z.string().uuid();

const argsSchema = z.object({
  userAccountId: uuidSchema,
  assetId: uuidSchema,
  dryRun: z.boolean(),
});

function printHelp(): void {
  console.log(`Usage:
  npx tsx tools/accounts/patch-security-cash-legs.ts --user-account-id <uuid> --asset-id <uuid>

Options:
  --user-account-id <uuid>   user_accounts.id (must match the asset’s owner)
  --asset-id <uuid>           user_assets.id to scope security transactions

  --dry-run                   Log actions only; no inserts/updates

Rules:
  - Only rows with security_transactions.ledger_group_id IS NULL are processed (avoid doubling bundles).
  - Discriminator is the sign of security_transactions.value only: negative = sell → cash leg
    currencyValue = +|currency_value|; positive = buy → −|currency_value|. Zero delta is skipped.

Environment:
  DATABASE_URL must be set (e.g. export in your shell before running).
`);
}

function parseArgs(argv: string[]): z.infer<typeof argsSchema> {
  const raw: Record<string, string> = { dry_run: "false" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
    if (!a?.startsWith("--")) continue;
    const key = a.slice(2);
    if (key === "dry-run") {
      raw.dry_run = "true";
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    raw[key.replaceAll("-", "_")] = next;
    i++;
  }

  return argsSchema.parse({
    userAccountId: raw.user_account_id,
    assetId: raw.asset_id,
    dryRun: raw.dry_run === "true",
  });
}

function cashLegFromSecurityRow(
  valueStr: string,
  currencyValueStr: string
): DecimalValueString | null {
  const dv = Decimal(valueStr);
  const mag = Decimal(currencyValueStr).abs();
  if (mag.isZero()) {
    return null;
  }
  if (dv.gt(0)) {
    return createDecimalValueString(mag.neg().toString());
  }
  if (dv.lt(0)) {
    return createDecimalValueString(mag.toString());
  }
  return null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const asset = await db.query.userAssets.findFirst({
    where: and(
      eq(userAssets.id, args.assetId),
      eq(userAssets.userAccountId, args.userAccountId)
    ),
    columns: { id: true, name: true },
  });

  if (!asset) {
    console.error(
      "No user_assets row for this --asset-id and --user-account-id (or mismatch)."
    );
    process.exit(1);
  }

  const rows = await db
    .select({
      id: securityTransactions.id,
      assetSecurityId: securityTransactions.assetSecurityId,
      value: securityTransactions.value,
      currencyValue: securityTransactions.currencyValue,
      currency: securityTransactions.currency,
      valueDate: securityTransactions.valueDate,
      source: securityTransactions.source,
    })
    .from(securityTransactions)
    .innerJoin(
      userAssetSecurities,
      eq(securityTransactions.assetSecurityId, userAssetSecurities.id)
    )
    .where(
      and(
        eq(userAssetSecurities.userAssetId, args.assetId),
        isNull(securityTransactions.ledgerGroupId)
      )
    )
    .orderBy(
      asc(securityTransactions.valueDate),
      asc(securityTransactions.id)
    );

  if (rows.length === 0) {
    console.log(
      `Asset "${asset.name}" (${args.assetId}): no ungrouped security transactions to patch.`
    );
    return;
  }

  console.log(
    `Asset "${asset.name}" (${args.assetId}): ${rows.length} ungrouped security transaction(s).`
  );

  let created = 0;
  let skipped = 0;

  for (const st of rows) {
    const cashCurrency = cashLegFromSecurityRow(st.value, st.currencyValue);
    if (cashCurrency === null) {
      console.warn(
        `  skip ${st.id}: zero share delta or zero currency magnitude (value=${st.value}, currency=${st.currencyValue})`
      );
      skipped++;
      continue;
    }

    const cashValue = cashCurrency;
    const ledgerGroupId = randomUUID();

    if (args.dryRun) {
      console.log(
        `  [dry-run] would link ${st.id} ↔ new asset_transaction, group ${ledgerGroupId}, cash ${cashValue}, source ${st.source}`
      );
      created++;
      continue;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(securityTransactions)
        .set({ ledgerGroupId, updatedAt: sql`now()` })
        .where(eq(securityTransactions.id, st.id));

      await tx.insert(assetTransactions).values({
        assetId: args.assetId,
        value: cashValue,
        currencyValue: cashValue,
        fees: createDecimalValueString("0"),
        currency: st.currency,
        valueDate: st.valueDate,
        recordedAt: new Date(),
        source: st.source,
        ledgerGroupId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    console.log(
      `  linked ${st.id} → asset cash leg, group ${ledgerGroupId}, currencyValue ${cashValue}`
    );
    created++;
  }

  console.log(
    `Done. ${args.dryRun ? "Would create" : "Created"} ${created} bundle(s); skipped ${skipped}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
