/**
 * Exercise {@link OcrService} against a local image or PDF (no HTTP, no DB).
 *
 * Usage (from repo root):
 *   npx tsx dev/test-ocr.ts <file-path> [--platform <key>] [--names <comma-separated>]
 *   npm run test:ocr -- ./path/to/statement.pdf
 *
 * Loads `ANTHROPIC_API_KEY` from `.local.env` in the project root.
 */
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { OcrService, isSupportedMimeType } from "@server/services/ocr";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
dotenv.config({ path: resolve(projectRoot, ".local.env") });

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
  --platform <key>   Broker platform key (default: unknown)
  --names <list>     Comma-separated platform display names for the prompt
  -h, --help         Show this help

Example:
  npm run test:ocr -- ./samples/statement.pdf --platform hl --names "Hargreaves Lansdown"
`);
}

type Parsed =
  | { kind: "help"; exitCode: number }
  | { kind: "run"; filePath: string; platformKey: string; platformNames: string[] };

function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  let platformKey = "unknown";
  let namesRaw = "";

  const args = [...argv];
  while (args.length > 0) {
    const a = args.shift();
    if (a === undefined) break;
    if (a === "--help" || a === "-h") {
      return { kind: "help", exitCode: 0 };
    }
    if (a === "--platform") {
      platformKey = args.shift() ?? "unknown";
      continue;
    }
    if (a === "--names") {
      namesRaw = args.shift() ?? "";
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

  return {
    kind: "run",
    filePath,
    platformKey,
    platformNames,
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

  const absolutePath = resolve(process.cwd(), parsed.filePath);
  const mimeType = mimeFromPath(absolutePath);
  if (!mimeType) {
    console.error(
      `Could not infer MIME type from extension. Use one of: .pdf, .jpg, .jpeg, .png, .gif, .webp`
    );
    process.exit(1);
  }
  if (!isSupportedMimeType(mimeType)) {
    console.error(`Unsupported MIME type: ${mimeType}`);
    process.exit(1);
  }

  const buffer = await readFile(absolutePath);
  console.error(`Reading ${absolutePath} (${mimeType}, ${buffer.length} bytes)`);
  console.error(
    `platformKey=${parsed.platformKey} platformNames=[${parsed.platformNames.join(", ")}]`
  );

  const ocr = new OcrService();
  const start = Date.now();
  const results = await ocr.extract(
    buffer,
    mimeType,
    parsed.platformKey,
    parsed.platformNames
  );
  const ms = Date.now() - start;

  console.log(JSON.stringify({ elapsedMs: ms, count: results.length, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
