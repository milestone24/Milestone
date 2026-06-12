import type { DocumentOcrPipelineResult, ExtractedAmount } from "./document";

export type QueryMessage = {
  type: "query";
  queryKeys: string[][];
};

export type NotificationMessage = {
  type: "notification";
  message: string;
};

/** WebSocket payload after document OCR completes (matches queue publish shape). */
export type DocumentOcrCompletedSocketMessage = {
  type: "document-ocr-completed";
  jobId: string;
  ocrJobId: string;
  accountId: string;
  documentId: string;
  extractedValues: ExtractedAmount[];
  pipeline?: DocumentOcrPipelineResult;
};

export type SocketMessage =
  | QueryMessage
  | NotificationMessage
  | DocumentOcrCompletedSocketMessage;

export const isQueryMessage = (
  message: SocketMessage
): message is QueryMessage => {
  return message.type === "query";
};

export const isNotificationMessage = (
  message: SocketMessage
): message is NotificationMessage => {
  return message.type === "notification";
};

export const isDocumentOcrCompletedSocketMessage = (
  message: SocketMessage
): message is DocumentOcrCompletedSocketMessage => {
  return message.type === "document-ocr-completed";
};
