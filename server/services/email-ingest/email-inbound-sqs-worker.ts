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
const WAIT_SECONDS = 20;

function logLine(message: string, meta?: Record<string, unknown>): void {
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[email-inbound-sqs] ${message}${suffix}`);
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
 */
export function startEmailInboundSqsWorker(): void {
  const queueUrl = process.env.EMAIL_INBOUND_SQS_QUEUE_URL?.trim();
  if (!queueUrl) {
    logLine("worker disabled (EMAIL_INBOUND_SQS_QUEUE_URL unset)");
    return;
  }

  const expectedTopicArn =
    process.env.EMAIL_INBOUND_SNS_TOPIC_ARN?.trim() || undefined;

  const client = new SQSClient({
    region: process.env.AWS_REGION ?? "eu-west-2",
  });

  void (async () => {
    logLine("worker started", { queueUrl });
    while (true) {
      try {
        const response = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: MAX_MESSAGES,
            WaitTimeSeconds: WAIT_SECONDS,
            VisibilityTimeout: 300,
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
