import { db } from "@api/db";
import { DatabaseAssetService } from "@api/services/assets/database";

const assetService = new DatabaseAssetService(db);

const query = {
  filter: {
    start: { eq: "2024-01-01" },
    end: { eq: "2025-09-04" },
  },
};

const run = async () => {
  const result = await assetService.getPortfolioValueHistoryForUser(
    "f4236b2a-7114-4c21-b8c2-531889dee544"
    //`query
  );

  return result;
};

run()
  .then((dateRange) => {
    console.log("done");
    //console.log(dateRange);
  })
  .catch((error) => {
    console.error(error);
  });
