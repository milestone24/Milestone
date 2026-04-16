/**
 * Parses SNS → SQS bodies for Amazon SES inbound receipts that used an S3 action.
 * @see https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
 */

export type SesS3ReceiptLocation = {
  bucketName: string;
  objectKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readS3ActionFromReceipt(receipt: unknown): SesS3ReceiptLocation | null {
  if (!isRecord(receipt)) {
    return null;
  }
  const action = receipt.action;
  const actions = receipt.actions;

  const candidates: unknown[] = [];
  if (Array.isArray(actions)) {
    candidates.push(...actions);
  } else if (action !== undefined) {
    candidates.push(action);
  }

  for (const item of candidates) {
    if (!isRecord(item)) {
      continue;
    }
    if (item.type !== "S3") {
      continue;
    }
    const bucketName = item.bucketName;
    const objectKey = item.objectKey;
    if (typeof bucketName === "string" && typeof objectKey === "string") {
      return { bucketName, objectKey };
    }
  }
  return null;
}

/**
 * Parses the JSON string stored in an SQS message body when the queue is
 * subscribed to SNS (default raw JSON delivery).
 */
export function parseSesS3LocationFromSqsBody(
  body: string,
): SesS3ReceiptLocation | null {
  let outer: unknown;
  try {
    outer = JSON.parse(body) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(outer)) {
    return null;
  }

  if (outer.Type === "SubscriptionConfirmation") {
    return null;
  }

  let sesPayload: unknown = outer;
  if (outer.Type === "Notification" && typeof outer.Message === "string") {
    try {
      sesPayload = JSON.parse(outer.Message) as unknown;
    } catch {
      return null;
    }
  }

  if (!isRecord(sesPayload)) {
    return null;
  }

  if (sesPayload.notificationType !== "Received") {
    return null;
  }

  const receipt = sesPayload.receipt;
  return readS3ActionFromReceipt(receipt);
}

export function readSnsTopicArnFromSqsBody(body: string): string | null {
  let outer: unknown;
  try {
    outer = JSON.parse(body) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(outer)) {
    return null;
  }
  const arn = outer.TopicArn;
  return typeof arn === "string" ? arn : null;
}
