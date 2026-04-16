/**
 * SSM Parameter Store names for document inbound email (SES → S3 + SNS → SQS).
 * Must match `MilestoneEmailInboundStack` and any app reader of these keys.
 */

/** SQS queue name for SNS fan-out (must match `MilestoneEmailInboundStack`). */
export const EMAIL_INBOUND_NOTIFY_QUEUE_NAME = "milestone-email-inbound-notify";

export const EMAIL_INBOUND_S3_BUCKET_PARAMETER_NAME =
  "/milestone/email-inbound/s3-bucket-name";

export const EMAIL_INBOUND_SNS_TOPIC_ARN_PARAMETER_NAME =
  "/milestone/email-inbound/sns-topic-arn";

/** Queue URL for workers consuming SES/S3 arrival notifications (SNS → SQS). */
export const EMAIL_INBOUND_SQS_QUEUE_URL_PARAMETER_NAME =
  "/milestone/email-inbound/sqs-queue-url";

export const EMAIL_INBOUND_MAIL_FQDN_PARAMETER_NAME =
  "/milestone/email-inbound/mail-fqdn";

/**
 * Plus-address local-part prefix before `{shortCode}` (e.g. `ingest` → `ingest+abc...@host`).
 * Populates process env `EMAIL_INGEST_LOCAL_PART_PREFIX` on EC2 via deploy. Must match ingest workers.
 */
export const EMAIL_INBOUND_LOCAL_PART_PREFIX_PARAMETER_NAME =
  "/milestone/email-inbound/local-part-prefix";
