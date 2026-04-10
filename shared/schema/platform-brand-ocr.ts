import { z } from "zod";

/**
 * How a **statement platform** (broker) name candidate was inferred.
 * This is **not** securities metadata — no tickers or ISINs here.
 */
export const statementPlatformBrandInferenceMethod = z.enum([
  "text",
  "pixel",
]);

export type StatementPlatformBrandInferenceMethod = z.infer<
  typeof statementPlatformBrandInferenceMethod
>;

/**
 * One ranked hypothesis for **which broker platform** produced the statement,
 * as returned by Phase 1 structured LLM output.
 */
export const statementPlatformBrandCandidateSchema = z.object({
  /** Printed or inferred platform / broker name (e.g. statement masthead). Not a security symbol. */
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
  inferenceMethod: statementPlatformBrandInferenceMethod,
  /** Short excerpt from the document or description of visual cue; optional audit / UX. */
  evidenceSnippet: z.string().optional(),
  /** Lower means stronger when multiple candidates are returned (optional model hint). */
  rank: z.number().int().min(0).optional(),
});

export type StatementPlatformBrandCandidate = z.infer<
  typeof statementPlatformBrandCandidateSchema
>;

/**
 * Phase 1 AI output: one or more platform-brand candidates for DB verification (3b / 3c).
 */
export const statementPlatformBrandIdentificationSchema = z.object({
  candidates: z
    .array(statementPlatformBrandCandidateSchema)
    .min(1, "At least one platform brand candidate is required"),
});

export type StatementPlatformBrandIdentification = z.infer<
  typeof statementPlatformBrandIdentificationSchema
>;

export const statementPlatformBrandMatchKind = z.enum([
  "exact",
  "normalized",
  "fuzzy",
  "none",
]);

export type StatementPlatformBrandMatchKind = z.infer<
  typeof statementPlatformBrandMatchKind
>;

export const statementPlatformBrandMatchRejectReason = z.enum([
  "no_database_match",
  "config_platform_mismatch",
  "low_confidence",
  "ambiguous_match",
]);

export type StatementPlatformBrandMatchRejectReason = z.infer<
  typeof statementPlatformBrandMatchRejectReason
>;

const statementPlatformBrandDbMatchBaseSchema = z.object({
  matchedBrokerPlatformId: z.string().uuid().nullable(),
  matchKind: statementPlatformBrandMatchKind,
  fuzzyScore: z.number().min(0).max(1).optional(),
  /** When the OCR run included a configured broker platform id, echo it here for auditing. */
  configuredBrokerPlatformId: z.string().uuid().optional(),
  /**
   * When `configuredBrokerPlatformId` is set: `true` if it equals `matchedBrokerPlatformId`,
   * `false` if both are set but differ. Omitted when there was no configured platform for this run.
   */
  matchesConfiguredPlatform: z.boolean().optional(),
  ok: z.boolean(),
  rejectReason: statementPlatformBrandMatchRejectReason.optional(),
});

/**
 * Result of **code** verification after resolving AI candidates against `broker_platforms`
 * (and optional alignment with the platform id supplied for this OCR run — step 3c).
 */
export const statementPlatformBrandDbMatchSchema =
  statementPlatformBrandDbMatchBaseSchema.superRefine((v, ctx) => {
    if (v.ok) {
      if (v.rejectReason !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "rejectReason must be omitted when ok is true",
          path: ["rejectReason"],
        });
      }
      if (v.matchedBrokerPlatformId === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "matchedBrokerPlatformId is required when ok is true",
          path: ["matchedBrokerPlatformId"],
        });
      }
      if (v.matchKind === "none") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "matchKind cannot be none when ok is true",
          path: ["matchKind"],
        });
      }
      if (
        v.configuredBrokerPlatformId !== undefined &&
        v.matchesConfiguredPlatform !== true
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "matchesConfiguredPlatform must be true when ok is true and configuredBrokerPlatformId is set",
          path: ["matchesConfiguredPlatform"],
        });
      }
      if (
        v.configuredBrokerPlatformId !== undefined &&
        v.matchedBrokerPlatformId !== null &&
        v.matchedBrokerPlatformId !== v.configuredBrokerPlatformId
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "matchedBrokerPlatformId must equal configuredBrokerPlatformId when ok is true",
          path: ["matchedBrokerPlatformId"],
        });
      }
    } else if (v.rejectReason === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rejectReason is required when ok is false",
        path: ["rejectReason"],
      });
    }

    if (v.configuredBrokerPlatformId === undefined) {
      if (v.matchesConfiguredPlatform !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "matchesConfiguredPlatform must be omitted when configuredBrokerPlatformId is omitted",
          path: ["matchesConfiguredPlatform"],
        });
      }
    } else if (v.matchesConfiguredPlatform === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "matchesConfiguredPlatform is required when configuredBrokerPlatformId is set",
        path: ["matchesConfiguredPlatform"],
      });
    } else if (v.matchesConfiguredPlatform === true) {
      if (v.matchedBrokerPlatformId === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "matchedBrokerPlatformId is required when matchesConfiguredPlatform is true",
          path: ["matchedBrokerPlatformId"],
        });
      } else if (v.matchedBrokerPlatformId !== v.configuredBrokerPlatformId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "matchedBrokerPlatformId must equal configuredBrokerPlatformId when matchesConfiguredPlatform is true",
          path: ["matchesConfiguredPlatform"],
        });
      }
    } else {
      // matchesConfiguredPlatform === false (configured id is set)
      if (v.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ok must be false when matchesConfiguredPlatform is false",
          path: ["ok"],
        });
      }
      if (v.rejectReason === undefined) {
        // Global rule already requires rejectReason when ok is false; skip reason-specific checks.
      } else if (v.matchedBrokerPlatformId === null) {
        if (
          v.rejectReason !== "no_database_match" &&
          v.rejectReason !== "ambiguous_match"
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "rejectReason must be no_database_match or ambiguous_match when matchesConfiguredPlatform is false and there is no matched platform",
            path: ["rejectReason"],
          });
        }
      } else if (v.matchedBrokerPlatformId === v.configuredBrokerPlatformId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "matchesConfiguredPlatform cannot be false when matched and configured broker platform ids are equal",
          path: ["matchesConfiguredPlatform"],
        });
      } else if (v.rejectReason !== "config_platform_mismatch") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "rejectReason must be config_platform_mismatch when matchesConfiguredPlatform is false and matched differs from configured broker platform",
          path: ["rejectReason"],
        });
      }
    }
  });

export type StatementPlatformBrandDbMatch = z.infer<
  typeof statementPlatformBrandDbMatchSchema
>;
