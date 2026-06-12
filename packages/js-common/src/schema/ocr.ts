import { z } from "zod";
import Decimal from "decimal.js";
import { SecurityTransactionInsert, SecurityTransactionOrphanInsert, securityTransactionOrphanInsertSchema } from "./transaction";
import { createDecimalValueString } from "./decimal-value";

/** Optional identity fields an OCR model may emit before `assetSecurityId` resolution. */
export type OcrSecurityIdentityFieldKey = "name" | "isin" | "symbol";

export type OcrSecurityIdentityShape = Partial<
  Record<OcrSecurityIdentityFieldKey, string | undefined>
>;

/**
 * How to combine {@link OcrSecurityIdentityRule.fields}:
 * - `all`: every listed field must be non-empty after trim (AND).
 * - `any`: at least one listed field must be non-empty (OR).
 */
export type OcrSecurityIdentityRule = {
  fields: readonly OcrSecurityIdentityFieldKey[];
  mode: "all" | "any";
};

function isOcrSecurityIdentityFieldPresent(
  v: OcrSecurityIdentityShape,
  field: OcrSecurityIdentityFieldKey
): boolean {
  const s = v[field];
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Returns a predicate closed over `rule` for use in Zod `.refine` or manual checks.
 * Change {@link securityTransactionOcrIdentityRule} to adjust product requirements
 * (e.g. add `isin` or switch to `mode: "any"`).
 */
export function createOcrSecurityIdentityPredicate(
  rule: OcrSecurityIdentityRule
): (v: OcrSecurityIdentityShape) => boolean {
  return (v) => {
    if (rule.fields.length === 0) return false;
    if (rule.mode === "all") {
      return rule.fields.every((f) => isOcrSecurityIdentityFieldPresent(v, f));
    }
    return rule.fields.some((f) => isOcrSecurityIdentityFieldPresent(v, f));
  };
}

const OCR_SECURITY_IDENTITY_FIELD_LABEL: Record<
  OcrSecurityIdentityFieldKey,
  string
> = {
  name: "name",
  isin: "ISIN",
  symbol: "symbol",
};

/** User-facing Zod message for a given rule (keeps copy in one place). */
export function ocrSecurityIdentityRuleRefinementMessage(
  rule: OcrSecurityIdentityRule
): string {
  const parts = rule.fields.map((f) => OCR_SECURITY_IDENTITY_FIELD_LABEL[f]);
  if (parts.length === 0) return "Identity fields are required";
  if (rule.mode === "any") {
    if (parts.length === 1) return `${parts[0]} is required`;
    return `At least one of ${parts.join(", ")} is required`;
  }
  if (parts.length === 1) return `${parts[0]} is required`;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]} are required`;
  const last = parts[parts.length - 1]!;
  return `${parts.slice(0, -1).join(", ")}, and ${last} are required`;
}

/**
 * Product default: resolvers lean on **name + symbol**; ISIN is optional on the object
 * but not part of the required set until matching supports it.
 */
export const securityTransactionOcrIdentityRule: OcrSecurityIdentityRule = {
  fields: ["name", "symbol"],
  mode: "all",
};

const matchesSecurityTransactionOcrIdentity = createOcrSecurityIdentityPredicate(
  securityTransactionOcrIdentityRule
);

const securityTransactionOcrIdentityRefineMessage =
  ocrSecurityIdentityRuleRefinementMessage(securityTransactionOcrIdentityRule);

/**
 * Identity read from a statement for resolving `assetSecurityId` (not stored on
 * `security_transactions` — use {@link securityTransactionOcrRowToInsert} after lookup).
 */
export const securityTransactionOcrSecurityIdentitySchema = z
  .object({
    /** As printed on the statement (fund or security name). */
    name: z.string().optional(),
    isin: z.string().optional(),
    symbol: z.string().optional(),
  })
  .refine(matchesSecurityTransactionOcrIdentity, {
    message: securityTransactionOcrIdentityRefineMessage,
  });

/**
 * One OCR row that **uses the same value shapes** as {@link securityTransactionOrphanInsertSchema}
 * for every insertable column the model can fill, plus identity and audit fields.
 *
 * After validation: {@link securityTransactionOcrRowToOrphanInsert} yields a value assignable to
 * {@link SecurityTransactionOrphanInsert} (with `source: "ocr"`). With a resolved
 * `assetSecurityId`, {@link securityTransactionOcrRowToInsert} yields {@link SecurityTransactionInsert}.
 *
 * The model must **not** emit `source`, `flags`, or `assetSecurityId`; those are app-owned.
 */
export const securityTransactionOcrExtractionRowSchema =
  securityTransactionOrphanInsertSchema
    .pick({
      value: true,
      currencyValue: true,
      fees: true,
      currency: true,
      valueDate: true,
      recordedAt: true,
    })
    .extend({
      name: z.string().optional(),
      isin: z.string().optional(),
      symbol: z.string().optional(),
      confidence: z.number().min(0).max(1),
      evidenceSnippet: z.string().optional(),
    })
    .refine(matchesSecurityTransactionOcrIdentity, {
      message: securityTransactionOcrIdentityRefineMessage,
    });

export type SecurityTransactionOcrExtractionRow = z.infer<
  typeof securityTransactionOcrExtractionRowSchema
>;

export const securityTransactionOcrExtractionListSchema = z.array(
  securityTransactionOcrExtractionRowSchema
);

/**
 * One OCR security row as evaluated under a specific user asset candidate.
 * Every asset candidate lists **all** document rows; `matched` indicates whether
 * that row mapped to a holding within that asset. `verified` reflects the schema
 * gate (4b) — rows already in the pipeline are typically `true` after Zod parse.
 */
export const ocrAssetCandidateSecuritySchema = z
  .object({
    ocrRow: securityTransactionOcrExtractionRowSchema,
    verified: z.boolean(),
    matched: z.boolean(),
    userAssetSecurityId: z.string().uuid().nullable(),
  })
  .refine((s) => !s.matched || s.userAssetSecurityId !== null, {
    message: "userAssetSecurityId is required when matched is true",
  });

export type OcrAssetCandidateSecurity = z.infer<typeof ocrAssetCandidateSecuritySchema>;

/**
 * One user asset (account) evaluated as a candidate for explaining the statement.
 * `securities` contains every OCR row from the document — same length and order
 * across all asset candidates in a result. `matchedCount` / `totalCount` are
 * denormalised for decision logic (e.g. auto-insert when exactly one asset has
 * `matchedCount === totalCount`).
 */
export const ocrAssetCandidateResultSchema = z
  .object({
    userAssetId: z.string().uuid(),
    assetName: z.string(),
    /** `user_assets.platform_id` for this account; null if unset. */
    userAssetPlatformId: z.string().uuid().nullable().default(null),
    /**
     * True when brand verification found a platform and this account is assigned to
     * the same `broker_platforms` row as the matched statement.
     */
    alignsWithMatchedStatementPlatform: z.boolean().default(false),
    matchedCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative(),
    securities: z.array(ocrAssetCandidateSecuritySchema),
  })
  .refine((v) => v.matchedCount <= v.totalCount, {
    message: "matchedCount must not exceed totalCount",
  })
  .refine((v) => v.securities.length === v.totalCount, {
    message: "securities length must equal totalCount",
  });

export type OcrAssetCandidateResult = z.infer<typeof ocrAssetCandidateResultSchema>;

export const ocrAssetCandidateResultListSchema = z.array(ocrAssetCandidateResultSchema);

/**
 * Strips OCR-only fields and sets `source: "ocr"` for persistence.
 */
export function securityTransactionOcrRowToOrphanInsert(
  row: SecurityTransactionOcrExtractionRow,
): SecurityTransactionOrphanInsert {
  return {
    value: row.value,
    perUnitValue: createDecimalValueString(
      new Decimal(row.currencyValue)
        .div(new Decimal(row.value).abs())
        .toString(),
    ),
    currencyValue: row.currencyValue,
    fees: row.fees,
    currency: row.currency,
    valueDate: row.valueDate,
    recordedAt: row.recordedAt,
    source: "ocr",
  };
}

/**
 * Builds a full row for {@link securityTransactions} after identity resolution.
 */
export function securityTransactionOcrRowToInsert(
  row: SecurityTransactionOcrExtractionRow,
  assetSecurityId: string
): SecurityTransactionInsert {
  return {
    ...securityTransactionOcrRowToOrphanInsert(row),
    mode: "existing",
    assetSecurityId,
  };
}