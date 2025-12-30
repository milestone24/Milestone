import { factory as queueFactory } from "./queue";
import { sendNotification } from "../comms/socket";
import { AssetValuesService } from "../process/asset-values";
import { db } from "@server/db";

const queueService = queueFactory();

const assetValuesService = new AssetValuesService(db);

export const initQueueNotifications = () => {
  const callback = async (message: any) => {
    if (message.type === "asset-values-update-started") {
      sendNotification(message.accountId, {
        type: "notification",
        message: `Asset values update started for assetId: ${message.assetId}`,
      });
    }
    if (message.type === "asset-values-update-completed") {
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
  };
  queueService.subscribe(callback);
};
