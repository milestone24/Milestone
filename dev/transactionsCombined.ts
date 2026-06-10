import { DatabaseAssetService } from "../apps/api-primary-node/src/services/assets/database";
import { db } from "../apps/api-primary-node/src/db";
import {
  BrandedAbstractTransactionValue,
  WithAssetHistory,
} from "@shared/schema";
import { UserAsset } from "@shared/schema";

const assetService = new DatabaseAssetService(db);

const runSingle = async (assetId: string) => {
  const result =
    await assetService.getCombinedAssetTransactionsWithBoundariesForAsset(
      //"115b8ea3-69a5-4911-962f-ec2b1f41317b",//
      //"2aeb5285-c644-47eb-b463-7e56bb9de6f9",
      "ce95f3e8-5473-40d1-8077-625e4829bcd6",
      {
        filter: {
          start: { eq: "2025-05-01" },
          end: { eq: "2025-10-01" },
        },
      }
    );

  return result;
};

const runAll = async () => {
  const assets = await db.query.userAssets.findMany();

  const withHistory: WithAssetHistory<
    UserAsset,
    BrandedAbstractTransactionValue
  >[] = await Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      history: await runSingle(asset.id),
    }))
  );

  return withHistory;
};

// runSingle(
//   //"115b8ea3-69a5-4911-962f-ec2b1f41317b",//
//   //"2aeb5285-c644-47eb-b463-7e56bb9de6f9",
//   "ce95f3e8-5473-40d1-8077-625e4829bcd6"
// );

runAll().then((result) => {
  console.log("Result :", JSON.stringify(result, null, 2));
});
