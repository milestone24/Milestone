import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  parseSesS3LocationFromSqsBody,
  readSnsTopicArnFromSqsBody,
} from "./ses-s3-notification-parse";
import { processInboundS3MailObject } from "./process-inbound-s3-mail";

const MAX_MESSAGES = 5;

/** Long polling cap for `ReceiveMessage` (`WaitTimeSeconds`). */
const SQS_WAIT_TIME_MAX_SECONDS = 20;

/** Inclusive bounds for per-receive `VisibilityTimeout` override (seconds). */
const SQS_VISIBILITY_TIMEOUT_MIN_SECONDS = 0;
const SQS_VISIBILITY_TIMEOUT_MAX_SECONDS = 43_200;

function logLine(message: string, meta?: Record<string, unknown>): void {
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[email-inbound-sqs] ${message}${suffix}`);
}

function parseBoundedIntEnv(params: {
  raw: string | undefined;
  defaultValue: number;
  min: number;
  max: number;
  name: string;
}): number {
  const trimmed = params.raw?.trim();
  if (trimmed === undefined || trimmed === "") {
    return params.defaultValue;
  }
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n)) {
    logLine(`invalid integer for ${params.name}, using default`, {
      defaultValue: params.defaultValue,
    });
    return params.defaultValue;
  }
  if (n < params.min || n > params.max) {
    const clamped = Math.min(params.max, Math.max(params.min, n));
    logLine(`${params.name} out of range, clamping`, {
      requested: n,
      min: params.min,
      max: params.max,
      using: clamped,
    });
    return clamped;
  }
  return n;
}

function resolveReceiveMessageTiming(): {
  waitTimeSeconds: number;
  visibilityTimeoutSeconds: number;
} {
  const waitTimeSeconds = parseBoundedIntEnv({
    raw: process.env.EMAIL_INBOUND_SQS_WAIT_TIME_SECONDS,
    defaultValue: 20,
    min: 0,
    max: SQS_WAIT_TIME_MAX_SECONDS,
    name: "EMAIL_INBOUND_SQS_WAIT_TIME_SECONDS",
  });
  const visibilityTimeoutSeconds = parseBoundedIntEnv({
    raw: process.env.EMAIL_INBOUND_SQS_VISIBILITY_TIMEOUT_SECONDS,
    defaultValue: 300,
    min: SQS_VISIBILITY_TIMEOUT_MIN_SECONDS,
    max: SQS_VISIBILITY_TIMEOUT_MAX_SECONDS,
    name: "EMAIL_INBOUND_SQS_VISIBILITY_TIMEOUT_SECONDS",
  });
  return { waitTimeSeconds, visibilityTimeoutSeconds };
}

async function deleteMessage(
  client: SQSClient,
  queueUrl: string,
  receiptHandle: string,
): Promise<void> {
  await client.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    }),
  );
}

async function handleOneRawBody(
  body: string,
  expectedTopicArn: string | undefined,
): Promise<void> {
  if (expectedTopicArn) {
    const topicArn = readSnsTopicArnFromSqsBody(body);
    if (topicArn && topicArn !== expectedTopicArn) {
      logLine("skipping message: unexpected SNS TopicArn", {
        topicArn,
        expectedTopicArn,
      });
      return;
    }
  }

  const location = parseSesS3LocationFromSqsBody(body);
  if (!location) {
    logLine("skipping message: not a parseable SES→S3 receipt");
    return;
  }

  await processInboundS3MailObject({
    bucketName: location.bucketName,
    objectKey: location.objectKey,
  });
}

/**
 * Long-polls the inbound notify SQS queue (SNS → SQS) and runs the Stage 6
 * ingest pipeline. No-op when `EMAIL_INBOUND_SQS_QUEUE_URL` is unset (e.g. local dev).
 *
 * Optional tuning (seconds):
 * - `EMAIL_INBOUND_SQS_WAIT_TIME_SECONDS` — `ReceiveMessage` long poll wait (0–20, default 20).
 * - `EMAIL_INBOUND_SQS_VISIBILITY_TIMEOUT_SECONDS` — visibility for received messages (0–43200,
 *   default 300). Raise if OCR can exceed the queue visibility so messages are not retried mid-flight.
 */
export function startEmailInboundSqsWorker(): void {
  const queueUrl = process.env.EMAIL_INBOUND_SQS_QUEUE_URL?.trim();
  if (!queueUrl) {
    logLine("worker disabled (EMAIL_INBOUND_SQS_QUEUE_URL unset)");
    return;
  }

  const expectedTopicArn =
    process.env.EMAIL_INBOUND_SNS_TOPIC_ARN?.trim() || undefined;

  const { waitTimeSeconds, visibilityTimeoutSeconds } =
    resolveReceiveMessageTiming();

  const client = new SQSClient({
    region: process.env.AWS_REGION ?? "eu-west-2",
  });

  void (async () => {
    logLine("worker started", {
      queueUrl,
      waitTimeSeconds,
      visibilityTimeoutSeconds,
    });
    while (true) {
      try {
        const response = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: MAX_MESSAGES,
            WaitTimeSeconds: waitTimeSeconds,
            VisibilityTimeout: visibilityTimeoutSeconds,
          }),
        );

        const messages = response.Messages ?? [];
        for (const msg of messages) {
          const body = msg.Body;
          const receiptHandle = msg.ReceiptHandle;
          if (!body || !receiptHandle) {
            continue;
          }
          try {
            await handleOneRawBody(body, expectedTopicArn);
            await deleteMessage(client, queueUrl, receiptHandle);
          } catch (err) {
            logLine("message processing error (message will retry)", {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      } catch (err) {
        logLine("receive loop error", {
          error: err instanceof Error ? err.message : String(err),
        });
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  })();
}
