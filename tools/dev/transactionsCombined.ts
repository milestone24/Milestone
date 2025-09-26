import { DatabaseAssetService } from "@server/services/assets/database";
import { db } from "@server/db";

const assetService = new DatabaseAssetService(db);

const run = async () => {
  const result =
    await assetService.getCombinedAssetTransactionsWithBoundariesForAsset(
      //"115b8ea3-69a5-4911-962f-ec2b1f41317b",
      //"2aeb5285-c644-47eb-b463-7e56bb9de6f9",
      "ce95f3e8-5473-40d1-8077-625e4829bcd6",
      {
        filter: {
          start: { eq: "2025-01-01" },
          end: { eq: "2025-10-01" },
        },
      }
    );
  console.log("Result :", result);
};

run();
