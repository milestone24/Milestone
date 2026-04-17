/**
 * Exercise OCR from the CLI (no HTTP).
 *
 * Modes (`--mode` or implied defaults):
 * - **balances** — {@link OcrService.extract} (prepare + balance LLM). No DB.
 * - **balances-prepared** — {@link prepareOcrDocumentUserContentBase} then
 *   {@link OcrService.extractFromPrepared} (same balances outcome; use for `--abort-after-ms`
 *   on the balance LLM without running the full pipeline).
 * - **pipeline** — {@link runFullDocumentOcrPipeline} (3a–3c, 4a–4c, balances). Needs DB + account.
 * - **prepare** — document prep only (PDF native text vs vision path); no Anthropic.
 * - **dump-text** — PDF native transcript to stdout; no Anthropic / DB.
 *
 * Loads `.local.env` from the project root **before** importing server modules.
 */
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { z } from "zod";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
dotenv.config({ path: resolve(projectRoot, ".local.env") });

const uuidSchema = z.string().uuid();

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

type CliMode = "balances" | "balances-prepared" | "pipeline" | "prepare" | "dump-text";

function printHelp(): void {
  console.log(`Usage:
  npx tsx dev/test-ocr.ts [options] <file-path>

Modes (--mode, or implied):
  balances (default)     OcrService.extract — balances only, no DB.
  balances-prepared      prepareOcrDocumentUserContentBase + extractFromPrepared (supports --abort-after-ms on balances).
  pipeline               runFullDocumentOcrPipeline — needs DATABASE_URL and --account-id (or OCR_TEST_ACCOUNT_ID).
  prepare                Document prep only (JSON to stdout); no Anthropic.
  dump-text              PDF only: native transcript on stdout, metadata on stderr.

  --spike1               Shorthand for --mode pipeline (legacy).

Options:
  --mode <name>          One of: balances | balances-prepared | pipeline | prepare | dump-text
  --account-id <uuid>    user_accounts scope for pipeline phase 4c (implies pipeline if set).
  --nominated-user-asset-id <uuid>  Optional user_assets.id for pipeline upload context (or OCR_TEST_NOMINATED_USER_ASSET_ID).
  --platform <key>       Broker key: "unknown" or broker_platforms.id UUID (default: unknown)
  --names <list>         Comma-separated platform display names for balance extraction
  --verbose, -v          Log timings and truncated raw model text where applicable
  --abort-after-ms <n>   AbortSignal.timeout(n) for pipeline, balances-prepared, prepare, or dump-text (PDF)
  --dump-text            Same as --mode dump-text
  -h, --help             Show this help

Environment:
  ANTHROPIC_API_KEY              Required for balances, balances-prepared, pipeline (not prepare / dump-text).
  OCR_TEST_ACCOUNT_ID            Default --account-id for pipeline when flag omitted.
  OCR_TEST_NOMINATED_USER_ASSET_ID   Default for --nominated-user-asset-id when flag omitted.
  DATABASE_URL                   Required for pipeline.

Examples:
  npm run test:ocr -- ./samples/statement.pdf
  npm run test:ocr -- --mode pipeline --verbose --account-id <uuid> --platform <platform-uuid> --names "InvestEngine" "./dev/statements/doc.pdf"
  npm run test:ocr -- --mode prepare ./samples/statement.pdf
  npm run test:ocr -- --dump-text ./samples/statement.pdf
  OCR_TEST_ACCOUNT_ID=<uuid> npm run test:ocr -- --mode pipeline ./file.pdf
`);
}

type Parsed =
  | { kind: "help"; exitCode: number }
  | {
      kind: "run";
      mode: CliMode;
      filePath: string;
      platformKey: string;
      platformNames: string[];
      accountId: string | undefined;
      nominatedUserAssetId: string | undefined;
      verbose: boolean;
      abortAfterMs: number | undefined;
    };

function parsePositiveInt(name: string, raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    throw new Error(`${name} requires a positive integer`);
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  return n;
}

function optionalAbortSignal(ms: number | undefined): AbortSignal | undefined {
  if (ms === undefined) {
    return undefined;
  }
  return AbortSignal.timeout(ms);
}

function parseArgs(argv: string[]): Parsed {
  const positionals: string[] = [];
  let explicitMode: CliMode | undefined;
  let platformKey = "unknown";
  let namesRaw = "";
  let spike1 = false;
  let accountId: string | undefined;
  let nominatedUserAssetId: string | undefined;
  let verbose = false;
  let dumpTextFlag = false;
  let abortAfterMs: number | undefined;

  const args = [...argv];
  while (args.length > 0) {
    const a = args.shift();
    if (a === undefined) break;
    if (a === "--help" || a === "-h") {
      return { kind: "help", exitCode: 0 };
    }
    if (a === "--dump-text") {
      dumpTextFlag = true;
      continue;
    }
    if (a === "--verbose" || a === "-v") {
      verbose = true;
      continue;
    }
    if (a === "--spike1") {
      spike1 = true;
      continue;
    }
    if (a === "--mode") {
      const v = args.shift();
      if (
        v !== "balances" &&
        v !== "balances-prepared" &&
        v !== "pipeline" &&
        v !== "prepare" &&
        v !== "dump-text"
      ) {
        throw new Error(
          `--mode must be one of: balances | balances-prepared | pipeline | prepare | dump-text (got "${v ?? ""}")`
        );
      }
      explicitMode = v;
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
    if (a === "--account-id") {
      accountId = args.shift();
      continue;
    }
    if (a === "--nominated-user-asset-id") {
      nominatedUserAssetId = args.shift();
      continue;
    }
    if (a === "--abort-after-ms") {
      abortAfterMs = parsePositiveInt("--abort-after-ms", args.shift());
      continue;
    }
    if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    }
    positionals.push(a);
  }

  if (positionals.length === 0) {
    return { kind: "help", exitCode: 1 };
  }
  if (positionals.length > 1) {
    throw new Error(
      `Expected a single file path; got ${String(positionals.length)} arguments: ${positionals.join(", ")}`
    );
  }
  const filePath = positionals[0]!;

  const envNominated = process.env.OCR_TEST_NOMINATED_USER_ASSET_ID?.trim();
  const resolvedNominated =
    nominatedUserAssetId?.trim() || (envNominated ? envNominated : undefined);

  const envAccount = process.env.OCR_TEST_ACCOUNT_ID?.trim();
  const resolvedAccount = accountId?.trim() || (envAccount ? envAccount : undefined);

  let mode: CliMode;

  if (dumpTextFlag) {
    if (explicitMode !== undefined && explicitMode !== "dump-text") {
      throw new Error("Cannot combine --dump-text with a different --mode");
    }
    mode = "dump-text";
  } else if (explicitMode !== undefined) {
    if (spike1 && explicitMode !== "pipeline") {
      throw new Error("Cannot combine --spike1 with --mode other than pipeline");
    }
    mode = spike1 ? "pipeline" : explicitMode;
    if (resolvedAccount && mode !== "pipeline") {
      throw new Error(
        "--account-id or OCR_TEST_ACCOUNT_ID is only valid with --mode pipeline (unset OCR_TEST_ACCOUNT_ID or pass an explicit pipeline mode)"
      );
    }
  } else if (spike1 || resolvedAccount) {
    mode = "pipeline";
  } else {
    mode = "balances";
  }

  if (resolvedNominated && mode !== "pipeline") {
    throw new Error(
      "--nominated-user-asset-id or OCR_TEST_NOMINATED_USER_ASSET_ID requires --mode pipeline"
    );
  }

  return {
    kind: "run",
    mode,
    filePath,
    platformKey,
    platformNames: namesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    accountId: resolvedAccount,
    nominatedUserAssetId: resolvedNominated,
    verbose,
    abortAfterMs,
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

function summarizePreparedBlocks(
  base: Anthropic.ContentBlockParam[]
): Array<Record<string, unknown>> {
  return base.map((block) => {
    if (block.type === "text") {
      return { type: "text", charCount: block.text.length };
    }
    if (block.type === "image") {
      const src = block.source;
      return {
        type: "image",
        media_type: "media_type" in src ? src.media_type : undefined,
        approxDataChars: "data" in src && typeof src.data === "string" ? src.data.length : undefined,
      };
    }
    if (block.type === "document") {
      const src = block.source;
      return {
        type: "document",
        media_type: "media_type" in src ? src.media_type : undefined,
        approxDataChars: "data" in src && typeof src.data === "string" ? src.data.length : undefined,
      };
    }
    return { type: block.type };
  });
}

async function runDumpText(
  filePath: string,
  abortAfterMs: number | undefined
): Promise<void> {
  const absolutePath = resolve(process.cwd(), filePath);
  const mimeType = mimeFromPath(absolutePath);
  if (mimeType !== "application/pdf") {
    console.error("--mode dump-text requires a .pdf file.");
    process.exit(1);
  }

  const buffer = await readFile(absolutePath);
  const {
    analyzeDocumentForOcrTranscript,
    loadPdfTextExtractionConfigFromEnv,
  } = await import("@server/services/pdf-text");

  const config = loadPdfTextExtractionConfigFromEnv();
  const signal = optionalAbortSignal(abortAfterMs);
  const analysis = await analyzeDocumentForOcrTranscript(buffer, mimeType, config, {
    abortSignal: signal,
  });

  if (analysis.kind !== "pdf_transcript") {
    console.error(`Unexpected analysis kind: ${analysis.kind}`);
    process.exit(1);
  }

  console.error(
    JSON.stringify(
      {
        file: absolutePath,
        bytes: buffer.length,
        totalPages: analysis.totalPages,
        charCount: analysis.charCount,
        wordCount: analysis.wordCount,
        useTranscriptPathInOcr: analysis.useTranscriptPath,
      },
      null,
      2
    )
  );
  process.stdout.write(analysis.fullTranscript);
  if (!analysis.fullTranscript.endsWith("\n")) {
    process.stdout.write("\n");
  }
}

async function runPrepareOnly(
  absolutePath: string,
  buffer: Buffer,
  mimeType: import("@server/services/ocr/document-user-content").SupportedOcrDocumentMimeType,
  abortAfterMs: number | undefined
): Promise<void> {
  const { prepareOcrDocumentUserContentBase } = await import(
    "@server/services/ocr/document-user-content"
  );
  const { loadPdfTextExtractionConfigFromEnv } = await import("@server/services/pdf-text");

  const config = loadPdfTextExtractionConfigFromEnv();
  const signal = optionalAbortSignal(abortAfterMs);
  const prepared = await prepareOcrDocumentUserContentBase(
    buffer,
    mimeType,
    config,
    signal
  );

  const payload = {
    file: absolutePath,
    bytes: buffer.length,
    mimeType,
    meta: prepared.meta,
    baseUserContent: summarizePreparedBlocks(prepared.baseUserContent),
  };
  console.log(JSON.stringify(payload, null, 2));
}

async function runBalancesPrepared(
  buffer: Buffer,
  mimeType: import("@server/services/ocr").SupportedMimeType,
  platformKey: string,
  platformNames: string[],
  verbose: boolean,
  abortAfterMs: number | undefined
): Promise<void> {
  const { OcrService } = await import("@server/services/ocr");
  const { prepareOcrDocumentUserContentBase } = await import(
    "@server/services/ocr/document-user-content"
  );
  const { loadPdfTextExtractionConfigFromEnv } = await import("@server/services/pdf-text");

  const ocr = new OcrService();
  const config = loadPdfTextExtractionConfigFromEnv();
  const verboseLog = verbose ? createVerboseLogger() : undefined;
  const signal = optionalAbortSignal(abortAfterMs);

  const start = Date.now();
  const prepared = await prepareOcrDocumentUserContentBase(
    buffer,
    mimeType,
    config,
    signal
  );
  const results = await ocr.extractFromPrepared(
    prepared,
    platformKey,
    platformNames,
    { verboseLog, abortSignal: signal }
  );
  const ms = Date.now() - start;
  console.log(JSON.stringify({ elapsedMs: ms, count: results.length, results }, null, 2));
}

function validatePipelinePrereqs(accountId: string | undefined): string {
  if (!accountId?.trim()) {
    console.error(
      "Pipeline mode requires --account-id <uuid> or OCR_TEST_ACCOUNT_ID in the environment."
    );
    process.exit(1);
  }
  const acc = uuidSchema.safeParse(accountId.trim());
  if (!acc.success) {
    console.error(`Invalid --account-id: must be a UUID (${acc.error.message})`);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "Pipeline mode requires DATABASE_URL (set in .local.env like the main app)."
    );
    process.exit(1);
  }
  return acc.data;
}

function validateOptionalNominee(raw: string | undefined): string | undefined {
  if (raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const parsed = uuidSchema.safeParse(raw.trim());
  if (!parsed.success) {
    console.error(`Invalid --nominated-user-asset-id: must be a UUID (${parsed.error.message})`);
    process.exit(1);
  }
  return parsed.data;
}

async function main(): Promise<void> {
  let parsed: Parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    printHelp();
    process.exit(1);
  }

  if (parsed.kind === "help") {
    printHelp();
    process.exit(parsed.exitCode);
  }

  if (parsed.mode === "dump-text") {
    await runDumpText(parsed.filePath, parsed.abortAfterMs);
    return;
  }

  const needsAnthropic =
    parsed.mode === "balances" ||
    parsed.mode === "balances-prepared" ||
    parsed.mode === "pipeline";

  if (needsAnthropic && !process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY (set in .local.env or the environment).");
    process.exit(1);
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
    `mode=${parsed.mode} platformKey=${parsed.platformKey} platformNames=[${parsed.platformNames.join(", ")}] verbose=${parsed.verbose} abortAfterMs=${parsed.abortAfterMs ?? "none"}`
  );

  if (parsed.mode === "prepare") {
    await runPrepareOnly(
      absolutePath,
      buffer,
      mimeType,
      parsed.abortAfterMs
    );
    return;
  }

  if (parsed.mode === "balances-prepared") {
    await runBalancesPrepared(
      buffer,
      mimeType,
      parsed.platformKey,
      parsed.platformNames,
      parsed.verbose,
      parsed.abortAfterMs
    );
    return;
  }

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

  const accountId = validatePipelinePrereqs(parsed.accountId);
  const nominatedUserAssetId = validateOptionalNominee(parsed.nominatedUserAssetId);

  console.error(`accountId=${accountId} (phase 4c portfolio check)`);
  if (nominatedUserAssetId) {
    console.error(`nominatedUserAssetId=${nominatedUserAssetId}`);
  }

  const signal = optionalAbortSignal(parsed.abortAfterMs);

  const { pipeline, extractedValues } = await runFullDocumentOcrPipeline({
    buffer,
    mimeType,
    platformKey: parsed.platformKey,
    platformNames: parsed.platformNames,
    accountId,
    nominatedUserAssetId,
    abortSignal: signal,
    verboseLog,
    extractBalances: (prepared, opts) =>
      ocr.extractFromPrepared(prepared, parsed.platformKey, parsed.platformNames, {
        verboseLog,
        abortSignal: opts?.abortSignal,
      }),
  });

  const ms = Date.now() - start;

  console.log(
    JSON.stringify(
      {
        elapsedMs: ms,
        pipeline,
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
