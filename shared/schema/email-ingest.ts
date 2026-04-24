import { z } from "zod";

const domainSuffixPattern =
  /^@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;

/**
 * Allow-list entry: full mailbox (`user@broker.com`) or domain suffix (`@broker.com`).
 */
export const emailIngestAllowedSenderSchema = z
  .string()
  .trim()
  .min(1)
  .max(254)
  .superRefine((val, ctx) => {
    if (val.startsWith("@")) {
      if (!domainSuffixPattern.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid domain suffix (expected @example.com)",
        });
      }
      return;
    }
    const parsed = z.string().email().safeParse(val);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid email address",
      });
    }
  });

export const emailIngestAllowedSendersSchema = z
  .array(emailIngestAllowedSenderSchema)
  .max(200);

export const emailIngestInboxCreateRequestSchema = z.object({
  platformKey: z.string().trim().min(1).max(128).nullable().optional(),
  allowedSenders: emailIngestAllowedSendersSchema.optional(),
  /** Portfolio account (`user_assets.id`) for OCR nominee; omit or null for none. */
  nominatedUserAssetId: z.string().uuid().nullable().optional(),
});

export type EmailIngestInboxCreateRequest = z.infer<
  typeof emailIngestInboxCreateRequestSchema
>;

export const emailIngestInboxUpdateAllowedSendersRequestSchema = z.object({
  allowedSenders: emailIngestAllowedSendersSchema,
});

export type EmailIngestInboxUpdateAllowedSendersRequest = z.infer<
  typeof emailIngestInboxUpdateAllowedSendersRequestSchema
>;

export const emailIngestInboxStatusSchema = z.enum(["active", "revoked"]);

export const emailIngestInboxResponseSchema = z.object({
  id: z.string().uuid(),
  shortCode: z.string(),
  platformKey: z.string().nullable(),
  nominatedUserAssetId: z.string().uuid().nullable(),
  allowedSenders: z.array(z.string()),
  status: emailIngestInboxStatusSchema,
  revokedAt: z.coerce.date().nullable(),
  replacedByInboxId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
  /** Full address to give brokers; null when `EMAIL_INBOUND_MAIL_FQDN` is unset. */
  ingestAddress: z.string().nullable(),
});

export type EmailIngestInboxResponse = z.infer<
  typeof emailIngestInboxResponseSchema
>;
