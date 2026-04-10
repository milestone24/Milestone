/**
 * Exercise OCR from the CLI (no HTTP).
 *
 * Modes:
 * - **Balances only** (default): single {@link OcrService.extract} — no DB.
 * - **Spike 1 full pipeline**: {@link runFullDocumentOcrPipeline} — phases 3a–3c, 4a–4c, then
 *   balance extraction. Requires DB (`DATABASE_URL` / Neon per server config) and
 *   `--account-id` or `OCR_TEST_ACCOUNT_ID` for phase 4c.
 *
 * Usage (from repo root):
 *   npm run test:ocr -- ./path/to/statement.pdf
 *   npm run test:ocr -- ./path/to/statement.pdf --spike1 --account-id <user-account-uuid>
 *   npm run test:ocr -- ./file.pdf --spike1 --account-id <uuid> -v
 *   OCR_TEST_ACCOUNT_ID=<uuid> npm run test:ocr -- ./file.pdf --spike1
 *
 * Loads `.local.env` from the project root **before** importing server modules.
 */
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
dotenv.config({ path: resolve(projectRoot, ".local.env") });

const accountIdSchema = z.string().uuid();

function mimeFromPath(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return map[ext] ?? null;
}

function printHelp(): void {
  console.log(`Usage:
  npx tsx dev/test-ocr.ts <file-path> [options]

Options:
  --spike1           Run full Spike 1 pipeline (brand + DB verify + securities + 4c + balances).
                     Requires DB and --account-id or OCR_TEST_ACCOUNT_ID.
  --account-id <uuid> User account id for phase 4c (portfolio ownership). Implies --spike1.
  --platform <key>   Broker platform key: "unknown" or broker_platforms.id UUID (default: unknown)
  --names <list>     Comma-separated platform display names for the balance-extraction prompt
  --verbose, -v      Log timings, raw model text (truncated if huge), parsed brand, DB match before fail
  -h, --help         Show this help

Environment:
  ANTHROPIC_API_KEY     Required for all modes.
  OCR_TEST_ACCOUNT_ID   Default account id when --spike1 and --account-id omitted.
  DATABASE_URL          Required for --spike1 (same as the app).

Examples:
  npm run test:ocr -- ./samples/statement.pdf
  npm run test:ocr -- ./samples/statement.pdf --spike1 --account-id 00000000-0000-0000-0000-000000000000
`);
}

type RunMode = "balances" | "spike1";

type Parsed =
  | { kind: "help"; exitCode: number }
  | {
      kind: "run";
      filePath: string;
      platformKey: string;
      platformNames: string[];
      mode: RunMode;
      accountId: string | undefined;
      verbose: boolean;
    };

function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  let platformKey = "unknown";
  let namesRaw = "";
  let spike1 = false;
  let accountId: string | undefined;
  let verbose = false;

  const args = [...argv];
  while (args.length > 0) {
    const a = args.shift();
    if (a === undefined) break;
    if (a === "--help" || a === "-h") {
      return { kind: "help", exitCode: 0 };
    }
    if (a === "--verbose" || a === "-v") {
      verbose = true;
      continue;
    }
    if (a === "--platform") {
      platformKey = args.shift() ?? "unknown";
      continue;
    }
    if (a === "--names") {
      namesRaw = args.shift() ?? "";
      continue;
    }
    if (a === "--spike1") {
      spike1 = true;
      continue;
    }
    if (a === "--account-id") {
      accountId = args.shift();
      continue;
    }
    if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    }
    positional.push(a);
  }

  const filePath = positional[0];
  if (!filePath) {
    return { kind: "help", exitCode: 1 };
  }

  const platformNames = namesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const envAccount = process.env.OCR_TEST_ACCOUNT_ID;
  const resolvedAccount = accountId ?? envAccount;
  if (resolvedAccount !== undefined) {
    spike1 = true;
  }

  return {
    kind: "run",
    filePath,
    platformKey,
    platformNames,
    mode: spike1 ? "spike1" : "balances",
    accountId: resolvedAccount,
    verbose,
  };
}

function createVerboseLogger() {
  return (step: string, detail?: Record<string, unknown>) => {
    console.error(`[ocr-verbose] ${step}`);
    if (detail !== undefined) {
      console.error(JSON.stringify(detail, null, 2));
    }
  };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.kind === "help") {
    printHelp();
    process.exit(parsed.exitCode);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY (set in .local.env or the environment).");
    process.exit(1);
  }

  if (parsed.mode === "spike1") {
    if (!parsed.accountId?.trim()) {
      console.error(
        "Spike 1 mode requires --account-id <uuid> or OCR_TEST_ACCOUNT_ID in the environment."
      );
      process.exit(1);
    }
    const acc = accountIdSchema.safeParse(parsed.accountId.trim());
    if (!acc.success) {
      console.error(`Invalid --account-id: must be a UUID (${acc.error.message})`);
      process.exit(1);
    }
    if (!process.env.DATABASE_URL?.trim()) {
      console.error(
        "Spike 1 mode requires DATABASE_URL (set in .local.env like the main app)."
      );
      process.exit(1);
    }
  }

  const absolutePath = resolve(process.cwd(), parsed.filePath);
  const mimeType = mimeFromPath(absolutePath);
  if (!mimeType) {
    console.error(
      `Could not infer MIME type from extension. Use one of: .pdf, .jpg, .jpeg, .png, .gif, .webp`
    );
    process.exit(1);
  }

  const {
    OcrService,
    isSupportedMimeType,
    runFullDocumentOcrPipeline,
  } = await import("@server/services/ocr");

  if (!isSupportedMimeType(mimeType)) {
    console.error(`Unsupported MIME type: ${mimeType}`);
    process.exit(1);
  }

  const buffer = await readFile(absolutePath);
  console.error(`Reading ${absolutePath} (${mimeType}, ${buffer.length} bytes)`);
  console.error(
    `platformKey=${parsed.platformKey} platformNames=[${parsed.platformNames.join(", ")}] mode=${parsed.mode} verbose=${parsed.verbose}`
  );

  const ocr = new OcrService();
  const start = Date.now();
  const verboseLog = parsed.verbose ? createVerboseLogger() : undefined;

  if (parsed.mode === "balances") {
    const results = await ocr.extract(
      buffer,
      mimeType,
      parsed.platformKey,
      parsed.platformNames,
      verboseLog ? { verboseLog } : undefined
    );
    const ms = Date.now() - start;
    console.log(JSON.stringify({ elapsedMs: ms, count: results.length, results }, null, 2));
    return;
  }

  const accountId = parsed.accountId!.trim();
  console.error(`accountId=${accountId} (phase 4c portfolio check)`);

  const { pipeline, extractedValues } = await runFullDocumentOcrPipeline({
    buffer,
    mimeType,
    platformKey: parsed.platformKey,
    platformNames: parsed.platformNames,
    accountId,
    verboseLog,
    extractBalances: (prepared) =>
      ocr.extractFromPrepared(
        prepared,
        parsed.platformKey,
        parsed.platformNames,
        verboseLog ? { verboseLog } : undefined
      ),
  });

  const ms = Date.now() - start;
  console.log(
    JSON.stringify(
      {
        elapsedMs: ms,
        pipeline: {
          llmPath: pipeline.llmPath,
          nativePdfCharCount: pipeline.nativePdfCharCount,
          brandDbMatch: pipeline.brandDbMatch,
          brandIdentification: pipeline.brandIdentification,
          securityHoldingsCount: pipeline.securityHoldings.length,
          securityHoldings: pipeline.securityHoldings,
        },
        balanceExtractCount: extractedValues.length,
        extractedValues,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
