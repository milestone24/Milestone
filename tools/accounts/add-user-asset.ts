/**
 * Create a user asset (broker account) from the CLI using securities already
 * present in `securities`. Symbols not found in the cache fail fast.
 *
 * Loads `.local.env` from the project root before importing server modules.
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import { findCachedSecurityMatch } from "@server/services/securities/cache/security";
import { db } from "@server/db";
import { brokerPlatforms, userAccounts } from "@server/db/schema";
import { DatabaseAssetService } from "@server/services/assets/database";
import {
  accountType,
  createDecimalValueString,
  userAssetInsertSchema,
  type SecurityInsert,
  type SecuritySelect,
} from "@shared/schema";
import { eq } from "drizzle-orm";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
dotenv.config({ path: resolve(projectRoot, ".local.env") });

const uuidSchema = z.string().uuid();

const accountTypeSchema = z.enum(accountType);

const argsSchema = z.object({
  userAccountId: uuidSchema,
  platformId: uuidSchema,
  name: z.string().min(4, "Name must be at least 4 characters"),
  accountType: accountTypeSchema,
  startDate: z.coerce.date(),
  symbols: z.array(z.string().min(1)).min(1, "At least one symbol is required"),
  valueMethod: z.enum(["calculated", "manual"]).default("calculated"),
  shareHolding: z.string().default("1"),
  currencyValue: z.string().default("1"),
  currentValue: z.string().optional(),
});

function printHelp(): void {
  console.log(`Usage:
  npx tsx tools/accounts/add-user-asset.ts [options]

Required:
  --user-account-id <uuid>   user_accounts.id
  --platform-id <uuid>       broker_platforms.id
  --name <string>              Asset name (min 4 characters)
  --account-type <type>      One of: ${accountType.join(" | ")}
  --start-date <iso>         Account start date (must be past, after 2000-01-01)
  --symbols <list>           Comma-separated symbols (must exist in securities table)

Optional:
  --value-method <mode>      calculated (default) | manual
  --share-holding <decimal>  Initial share holding per security (default: 1)
  --currency-value <decimal> Initial currency value per security (default: 1)
  --current-value <decimal>  Required for manual value method (portfolio value)

Notes:
  - Symbol lookup uses an exact match on securities.symbol (as stored).
  - Unknown symbols exit with a non-zero code and a clear error.
`);
}

function parseArgs(argv: string[]): z.infer<typeof argsSchema> {
  const raw: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
    if (!a?.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    raw[key.replaceAll("-", "_")] = next;
    i++;
  }

  const symbolsRaw = raw.symbols;
  if (!symbolsRaw) {
    throw new Error("Missing required --symbols");
  }

  const symbols = [...new Set(symbolsRaw.split(",").map((s) => s.trim()).filter(Boolean))];

  return argsSchema.parse({
    userAccountId: raw.user_account_id,
    platformId: raw.platform_id,
    name: raw.name,
    accountType: raw.account_type,
    startDate: raw.start_date,
    symbols,
    valueMethod: raw.value_method,
    shareHolding: raw.share_holding,
    currencyValue: raw.currency_value,
    currentValue: raw.current_value,
  });
}

function securitySelectToInsert(select: SecuritySelect): SecurityInsert {
  return {
    symbol: select.symbol,
    name: select.name,
    sourceIdentifier: select.sourceIdentifier,
    exchange: select.exchange,
    country: select.country,
    currency: select.currency,
    type: select.type,
    isin: select.isin ?? null,
    cusip: select.cusip ?? null,
    figi: select.figi ?? null,
  };
}

async function resolveSymbolsOrThrow(symbols: string[]): Promise<SecuritySelect[]> {
  const resolved: SecuritySelect[] = [];
  const missing: string[] = [];

  for (const symbol of symbols) {
    const row = await findCachedSecurityMatch(symbol);
    if (!row) {
      missing.push(symbol);
    } else {
      resolved.push(row);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Unknown securities (not in system cache): ${missing.join(", ")}`
    );
  }

  return resolved;
}

async function assertUserAccountExists(userAccountId: string): Promise<void> {
  const row = await db.query.userAccounts.findFirst({
    where: eq(userAccounts.id, userAccountId),
    columns: { id: true },
  });
  if (!row) {
    throw new Error(`user_accounts row not found for id ${userAccountId}`);
  }
}

async function assertBrokerPlatformExists(platformId: string): Promise<void> {
  const row = await db.query.brokerPlatforms.findFirst({
    where: eq(brokerPlatforms.id, platformId),
    columns: { id: true },
  });
  if (!row) {
    throw new Error(`broker_platforms row not found for id ${platformId}`);
  }
}

async function main(): Promise<void> {
  let args: z.infer<typeof argsSchema>;
  try {
    args = parseArgs(process.argv);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    printHelp();
    process.exit(1);
    return;
  }

  if (args.valueMethod === "manual" && !args.currentValue) {
    console.error("manual value method requires --current-value");
    process.exit(1);
    return;
  }

  await assertUserAccountExists(args.userAccountId);
  await assertBrokerPlatformExists(args.platformId);

  const securitiesResolved = await resolveSymbolsOrThrow(args.symbols);

  const shareHolding = createDecimalValueString(args.shareHolding);
  const currencyValue = createDecimalValueString(args.currencyValue);
  const startDate = args.startDate;

  const payload = {
    userAccountId: args.userAccountId,
    name: args.name,
    accountType: args.accountType,
    startDate,
    valueMethod: args.valueMethod,
    platformId: args.platformId,
    securities: securitiesResolved.map((s) => ({
      type: "new" as const,
      lid: randomUUID(),
      security: securitySelectToInsert(s),
      startDate,
      initialHolding: { shareHolding, currencyValue },
    })),
    ...(args.valueMethod === "manual" && args.currentValue
      ? { currentValue: createDecimalValueString(args.currentValue) }
      : {}),
  };

  const parsed = userAssetInsertSchema.safeParse(payload);
  if (!parsed.success) {
    console.error("Payload failed validation:", parsed.error.flatten());
    process.exit(1);
    return;
  }

  const assetService = new DatabaseAssetService(db);
  const created = await assetService.createUserAsset(parsed.data);

  console.log(JSON.stringify({ id: created.id, name: created.name }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
