import { factory as queueFactory } from "./queue";
import { Message, isDocumentOcrMessage } from "./queue";

import { AssetValuesService } from "../process/asset-values";
import { db } from "@server/db";
import { sendNotification } from "../comms/socket";
import { invalidateCache } from "../cache";

const assetValuesService = new AssetValuesService(db);
export const initUpdateChain = async () => {
  console.log("Initializing update chain");
  const queueService = queueFactory();
  const callback = async (message: Message) => {
    if (message.type === "asset-values-update-started") {
      sendNotification(message.accountId, {
        type: "notification",
        message: `Asset values update started for assetId: ${message.assetId}`,
      });
    }
    if (message.type === "asset-values-update-completed") {
      await invalidateCache(["portfolio", "assets"]);
      sendNotification(message.accountId, {
        type: "notification",
        message: `Asset values update completed for assetId: ${message.assetId}`,
      });
      assetValuesService.sendAssetValuesInvalidatedNotification(
        message.accountId,
        message.assetId
      );
    }
    if (message.type === "asset-values-update-failed") {
      sendNotification(message.accountId, {
        type: "notification",
        message: `Asset values update failed for assetId: ${message.assetId}`,
      });
    }
    if (
      message.type === "securities-daily-history-cache-update-completed" ||
      message.type === "securities-daily-history-cache-update-failed" ||
      message.type === "securities-daily-history-cache-update-aborted"
    ) {
      if (message.groupId) {
        await assetValuesService.checkGroupCompleteAndTriggerAssetValues(
          message.groupId
        );
      }
    }
    if (isDocumentOcrMessage(message)) {
      if (message.type === "document-ocr-started") {
        sendNotification(message.accountId, {
          type: "notification",
          message: "Statement OCR started.",
        });
      }
      if (message.type === "document-ocr-completed") {
        sendNotification(message.accountId, {
          type: "document-ocr-completed",
          jobId: message.jobId,
          ocrJobId: message.ocrJobId,
          accountId: message.accountId,
          documentId: message.documentId,
          extractedValues: message.extractedValues,
          pipeline: message.pipeline,
        });
      }
      if (message.type === "document-ocr-failed") {
        sendNotification(message.accountId, {
          type: "notification",
          message: `Document OCR failed${message.message ? `: ${message.message}` : ""}`,
        });
      }
    }
    if (message.type === "securities-daily-history-cache-update-exited") {
      console.log(
        "Securities daily history cache update exited, updating asset values for all assets of all accounts"
      );
      //This will should eventually be a distributed event to trigger the asset values update for all assets of all accounts.
      await assetValuesService.updateAssetValuesForAllAssetsOfAllAccounts();
    }
  };
  queueService.subscribe(callback);
};
