import { db } from "@api/db";
import { DatabaseAssetService } from "@api/services/assets/database";

const service = new DatabaseAssetService(db);

async function run() {
  return service.getUserAssetSecurityShareHoldingsForDate(
    "5f3c8e0f-5be8-4d87-85f0-2d0b9932bef7",
    new Date()
  );
}

run().then((result) => {
  console.log(result);
});
