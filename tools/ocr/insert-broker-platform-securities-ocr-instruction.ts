/**
 * Example CLI: insert one row into `broker_platform_securities_ocr_context_instructions`
 * (phase 4a issuer hints), using {@link insertBrokerPlatformSecuritiesOcrContextInstruction}.
 *
 * Loads `.local.env` from the project root before importing server modules.
 *
 * @example
 * ```bash
 * npx tsx tools/ocr/insert-broker-platform-securities-ocr-instruction.ts \
 *   --broker-platform-id f60ee75b-43f5-4449-a671-fba3dcbe07e2 \
 *   --instruction "Holdings are usually on page 2; look for header 'Invest account - executed trades'."
 * ```
 *
 * @example Longer text via a quoted here-document (no shell expansion inside the body). The closing `EOF` must start at column 0 of that line.
 * ```bash
 * npx tsx tools/ocr/insert-broker-platform-securities-ocr-instruction.ts \
 *   --broker-platform-id f60ee75b-43f5-4449-a671-fba3dcbe07e2 \
 *   --instruction "$(cat <<'EOF'
 * The information for securities is likely to be on page two of the PDF.
 * We are looking for a page with a header 'Invest account - executed trades'.
 * EOF
 * )"
 * ```
 *
 * @example Programmatic (same service the CLI uses)
 * ```ts
 * import { insertBrokerPlatformSecuritiesOcrContextInstruction } from "@api/services/ocr/ocr-configuration-service";
 *
 * const { id } = await insertBrokerPlatformSecuritiesOcrContextInstruction({
 *   brokerPlatformId: "…uuid…",
 *   instructionText: "…",
 *   sortOrder: 0,
 *   isActive: true,
 * });
 * ```
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import { insertBrokerPlatformSecuritiesOcrContextInstruction } from "@api/services/ocr/ocr-configuration-service";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
dotenv.config({ path: resolve(projectRoot, ".local.env") });

const uuidSchema = z.string().uuid();

const argsSchema = z.object({
  brokerPlatformId: uuidSchema,
  instruction: z.string().min(1, "instruction text is required"),
  sortOrder: z.coerce.number().int().optional(),
  inactive: z.boolean().default(false),
});

function printHelp(): void {
  console.error(`Usage:
  npx tsx tools/ocr/insert-broker-platform-securities-ocr-instruction.ts \\
    --broker-platform-id <uuid> \\
    --instruction <text> \\
    [--sort-order <n>] \\
    [--inactive]

Inserts one active instruction row for the given broker_platforms.id (resolved platform id).

Longer or multi-line --instruction: pass one argument built from a quoted here-document
(command substitution). Use a quoted delimiter (<<'TAG') so nothing inside the body is expanded by the shell:

  npx tsx tools/ocr/insert-broker-platform-securities-ocr-instruction.ts \\
    --broker-platform-id <uuid> \\
    --instruction "\$(cat <<'EOF'
The information for securities is likely to be on page two of the PDF.
We are looking for a page with a header 'Invest account - executed trades'.
EOF
)"

The closing line must be exactly EOF with no leading spaces. Trailing newline from the here-doc is fine (instruction is trimmed on insert).
`);
}

function parseArgs(argv: string[]): z.infer<typeof argsSchema> {
  const raw: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    }
    if (!a?.startsWith("--")) continue;
    const key = a.slice(2);
    if (key === "inactive") {
      raw.inactive = "true";
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    raw[key.replace(/-/g, "_")] = next;
    i += 1;
  }

  return argsSchema.parse({
    brokerPlatformId: raw.broker_platform_id,
    instruction: raw.instruction,
    sortOrder: raw.sort_order,
    inactive: raw.inactive === "true",
  });
}

async function main(): Promise<void> {
  let parsed: z.infer<typeof argsSchema>;
  try {
    parsed = parseArgs(process.argv);
  } catch (e) {
    printHelp();
    if (e instanceof z.ZodError) {
      console.error(e.flatten().fieldErrors);
    } else {
      console.error(e instanceof Error ? e.message : e);
    }
    process.exit(1);
    return;
  }

  const { id } = await insertBrokerPlatformSecuritiesOcrContextInstruction({
    brokerPlatformId: parsed.brokerPlatformId,
    instructionText: parsed.instruction,
    sortOrder: parsed.sortOrder,
    isActive: !parsed.inactive,
  });

  console.log(JSON.stringify({ ok: true, id, brokerPlatformId: parsed.brokerPlatformId }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
