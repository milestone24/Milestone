import { factory as queueFactory } from "./queue";
import { Message } from "./queue";

import { AssetValuesService } from "../process/asset-values";
import { db } from "@server/db";

const assetValuesService = new AssetValuesService(db);
export const initUpdateChain = async () => {
  console.log("Initializing update chain");
  const queueService = queueFactory();
  const callback = async (message: Message) => {
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
