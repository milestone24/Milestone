/**
 * SSM Parameter Store names for document inbound email (SES → S3 + SNS → SQS).
 * Must match `MilestoneEmailInboundStack` and any app reader of these keys.
 *
 * Per-environment rails live under `/milestone/email-inbound/rails/<mailSubdomain>/…`.
 * Shared bucket name remains at `/milestone/email-inbound/s3-bucket-name`.
 */

/** One SES receive rail per app environment (prod / staging / dev). */
export const EMAIL_INBOUND_RAIL_DEFINITIONS = [
  {
    mailSubdomain: "doc-inbound",
    queueName: "milestone-email-inbound-notify",
  },
  {
    mailSubdomain: "doc-inbound-staging",
    queueName: "milestone-email-inbound-notify-staging",
  },
  {
    mailSubdomain: "doc-inbound-dev",
    queueName: "milestone-email-inbound-notify-dev",
  },
] as const;

export type EmailInboundMailSubdomain =
  (typeof EMAIL_INBOUND_RAIL_DEFINITIONS)[number]["mailSubdomain"];

export const DEFAULT_EMAIL_INBOUND_MAIL_SUBDOMAIN: EmailInboundMailSubdomain =
  "doc-inbound";

export function emailInboundRailSsmPrefix(mailSubdomain: string): string {
  return `/milestone/email-inbound/rails/${mailSubdomain}`;
}

export function emailInboundMailFqdnParameterName(
  mailSubdomain: string,
): string {
  return `${emailInboundRailSsmPrefix(mailSubdomain)}/mail-fqdn`;
}

export function emailInboundSnsTopicArnParameterName(
  mailSubdomain: string,
): string {
  return `${emailInboundRailSsmPrefix(mailSubdomain)}/sns-topic-arn`;
}

export function emailInboundSqsQueueUrlParameterName(
  mailSubdomain: string,
): string {
  return `${emailInboundRailSsmPrefix(mailSubdomain)}/sqs-queue-url`;
}

/**
 * Optional second queue per rail: same SNS topic as the worker queue, for
 * side-channel inspection without competing for messages with the app.
 */
export function emailInboundTapSqsQueueUrlParameterName(
  mailSubdomain: string,
): string {
  return `${emailInboundRailSsmPrefix(mailSubdomain)}/sqs-tap-queue-url`;
}

export const EMAIL_INBOUND_S3_BUCKET_PARAMETER_NAME =
  "/milestone/email-inbound/s3-bucket-name";

/**
 * Plus-address local-part prefix before `{shortCode}` (e.g. `ingest` → `ingest+abc...@host`).
 * Populates process env `EMAIL_INGEST_LOCAL_PART_PREFIX` on EC2 via deploy. Must match ingest workers.
 */
export const EMAIL_INBOUND_LOCAL_PART_PREFIX_PARAMETER_NAME =
  "/milestone/email-inbound/local-part-prefix";

/** `ReceiveMessage` long poll wait (0–20 seconds); maps to `EMAIL_INBOUND_SQS_WAIT_TIME_SECONDS`. */
export const EMAIL_INBOUND_SQS_WAIT_TIME_SECONDS_PARAMETER_NAME =
  "/milestone/email-inbound/sqs-wait-time-seconds";

/** Per-receive visibility timeout (0–43200 seconds); maps to `EMAIL_INBOUND_SQS_VISIBILITY_TIMEOUT_SECONDS`. */
export const EMAIL_INBOUND_SQS_VISIBILITY_TIMEOUT_SECONDS_PARAMETER_NAME =
  "/milestone/email-inbound/sqs-visibility-timeout-seconds";

export function assertEmailInboundMailSubdomain(
  value: string,
): asserts value is EmailInboundMailSubdomain {
  if (
    !EMAIL_INBOUND_RAIL_DEFINITIONS.some((r) => r.mailSubdomain === value)
  ) {
    throw new Error(
      `emailInboundMailSubdomain must be one of ${EMAIL_INBOUND_RAIL_DEFINITIONS.map((r) => r.mailSubdomain).join(", ")}; got: ${value}`,
    );
  }
}

export function resolveEmailInboundMailSubdomain(
  value: string | undefined,
): EmailInboundMailSubdomain {
  const resolved = (value?.trim() || DEFAULT_EMAIL_INBOUND_MAIL_SUBDOMAIN) as string;
  assertEmailInboundMailSubdomain(resolved);
  return resolved;
}
