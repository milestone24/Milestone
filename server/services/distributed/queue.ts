import { EventEmitter } from "events";
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

export type AssetValuesUpdateMessageBase = {
  jobId: string;
  accountId: string;
  assetId: string;
  startDate?: Date;
};

type AssetValuesUpdateAbortMessage = {
  type: "asset-values-update-abort";
  jobId: string;
};

type AssetValuesUpdateStartedMessage = AssetValuesUpdateMessageBase & {
  type: "asset-values-update-started";
};

type AssetValuesUpdateCompletedMessage = AssetValuesUpdateMessageBase & {
  type: "asset-values-update-completed";
};

type AssetValuesUpdateFailedMessage = Omit<AssetValuesUpdateMessageBase, "jobId"> & {
  type: "asset-values-update-failed";
  jobId?: string;
  message?: string;
};

type AssetValuesUpdateExitedMessage = AssetValuesUpdateMessageBase & {
  type: "asset-values-update-exited";
};

type AssetValuesUpdateAbortedMessage = AssetValuesUpdateMessageBase & {
  type: "asset-values-update-aborted";
};

export type AssetValuesUpdateMessage =
  | AssetValuesUpdateAbortMessage
  | AssetValuesUpdateStartedMessage
  | AssetValuesUpdateCompletedMessage
  | AssetValuesUpdateFailedMessage
  | AssetValuesUpdateExitedMessage
  | AssetValuesUpdateAbortedMessage;

export const isAssetValuesUpdateMessage = (
  message: Message
): message is AssetValuesUpdateMessage => {
  return message.type.startsWith("asset-values-update-");
};

export type SecuritiesDailyHistoryCacheUpdateMessageBase = {
  jobId: string;
  groupId?: string;
  accountId?: string;
};

type SecuritiesDailyHistoryCacheUpdateAbortMessage =
  SecuritiesDailyHistoryCacheUpdateMessageBase & {
    type: "securities-daily-history-cache-update-abort";
  };

type SecuritiesDailyHistoryCacheUpdateStartedMessage =
  SecuritiesDailyHistoryCacheUpdateMessageBase & {
    type: "securities-daily-history-cache-update-started";
  };

type SecuritiesDailyHistoryCacheUpdateCompletedMessage =
  SecuritiesDailyHistoryCacheUpdateMessageBase & {
    type: "securities-daily-history-cache-update-completed";
  };
type SecuritiesDailyHistoryCacheUpdateFailedMessage =
  Omit<SecuritiesDailyHistoryCacheUpdateMessageBase, "jobId"> & {
    jobId?: string;
    type: "securities-daily-history-cache-update-failed";
    message?: string;
  };
type SecuritiesDailyHistoryCacheUpdateExitedMessage =
  SecuritiesDailyHistoryCacheUpdateMessageBase & {
    type: "securities-daily-history-cache-update-exited";
  };
type SecuritiesDailyHistoryCacheUpdateAbortedMessage =
  SecuritiesDailyHistoryCacheUpdateMessageBase & {
    type: "securities-daily-history-cache-update-aborted";
  };

export type SecuritiesDailyHistoryCacheUpdateMessage =
  | SecuritiesDailyHistoryCacheUpdateAbortMessage
  | SecuritiesDailyHistoryCacheUpdateStartedMessage
  | SecuritiesDailyHistoryCacheUpdateCompletedMessage
  | SecuritiesDailyHistoryCacheUpdateFailedMessage
  | SecuritiesDailyHistoryCacheUpdateExitedMessage
  | SecuritiesDailyHistoryCacheUpdateAbortedMessage;

export const isSecuritiesDailyHistoryCacheUpdateMessage = (
  message: Message
): message is SecuritiesDailyHistoryCacheUpdateMessage => {
  return message.type.startsWith("securities-daily-history-cache-update-");
};

type NotificationMessage = {
  type: "notification";
  message: string;
};

type DocumentOcrMessageBase = {
  jobId: string;
  accountId: string;
  documentId: string;
};

type DocumentOcrStartedMessage = DocumentOcrMessageBase & {
  type: "document-ocr-started";
};

type DocumentOcrCompletedMessage = DocumentOcrMessageBase & {
  type: "document-ocr-completed";
  extractedValues: import("@shared/schema/document").ExtractedAmount[];
};

type DocumentOcrFailedMessage = Omit<DocumentOcrMessageBase, "jobId"> & {
  type: "document-ocr-failed";
  jobId?: string;
  message?: string;
};

export type DocumentOcrMessage =
  | DocumentOcrStartedMessage
  | DocumentOcrCompletedMessage
  | DocumentOcrFailedMessage;

export const isDocumentOcrMessage = (
  message: Message
): message is DocumentOcrMessage => {
  return message.type.startsWith("document-ocr-");
};

export type Message =
  | AssetValuesUpdateMessage
  | SecuritiesDailyHistoryCacheUpdateMessage
  | DocumentOcrMessage
  | NotificationMessage;

type MessageCallback = (message: Message) => Promise<void>;

const MESSAGE_EVENT = "message";

abstract class QueueService {
  abstract publish(message: Message): Promise<void>;
  abstract subscribe(callback: MessageCallback): Promise<void>;
  /**
   * Removes the callback from the queue. Idempotent — safe to call multiple
   * times with the same callback (e.g. from both a handler and the job-scope
   * disposer); subsequent calls are no-ops.
   */
  abstract unsubscribe(callback: MessageCallback): Promise<void>;
}

class LocalQueueService extends QueueService {
  private emitter = new EventEmitter();

  async publish(message: Message): Promise<void> {
    this.emitter.emit(MESSAGE_EVENT, message);
  }

  async subscribe(callback: MessageCallback): Promise<void> {
    this.emitter.on(MESSAGE_EVENT, callback);
  }

  async unsubscribe(callback: MessageCallback): Promise<void> {
    this.emitter.off(MESSAGE_EVENT, callback);
    // EventEmitter.off is idempotent: already-removed listeners are a no-op.
  }
}

class SQSQueueService extends QueueService {
  private client: SQSClient;
  private queueUrl: string;
  private subscribers: MessageCallback[] = [];

  constructor() {
    super();
    this.client = new SQSClient({
      region: process.env.AWS_REGION ?? "eu-west-2",
    });
    this.queueUrl = process.env.SQS_QUEUE_URL ?? "";
  }

  async publish(message: Message): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
    });
    await this.client.send(command);
  }

  async subscribe(callback: MessageCallback): Promise<void> {
    this.subscribers.push(callback);

    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
    });

    const response = await this.client.send(command);

    if (response.Messages) {
      for (const sqsMessage of response.Messages) {
        if (sqsMessage.Body) {
          const message = JSON.parse(sqsMessage.Body) as Message;
          await callback(message);

          if (sqsMessage.ReceiptHandle) {
            await this.client.send(
              new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: sqsMessage.ReceiptHandle,
              })
            );
          }
        }
      }
    }
  }

  async unsubscribe(callback: MessageCallback): Promise<void> {
    const index = this.subscribers.indexOf(callback);
    if (index > -1) {
      this.subscribers.splice(index, 1);
    }
    // Idempotent: if already removed, index is -1 and we no-op.
  }
}

let instance: QueueService | null = null;

export const factory = () => {
  if (!instance) {
    instance =
      process.env.QUEUE_TYPE === "distributed"
        ? new SQSQueueService()
        : new LocalQueueService();
  }
  return instance;
};
