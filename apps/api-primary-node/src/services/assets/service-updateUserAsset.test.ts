import { describe, beforeAll, it, expect } from "vitest";
import { DatabaseAssetService } from "./database";
import { db } from "@/db";


describe("DatabaseAssetService updateUserAsset", () => {
  let databaseAssetService: DatabaseAssetService;

  beforeAll(async () => {
    databaseAssetService = new DatabaseAssetService(db);
  });

  it("should update a user asset", async () => {
    const userAsset = await databaseAssetService.updateUserAsset("bd065df3-dd5d-4059-b9cd-08f8caeae9f9", {
      startDate: new Date("2026-10-02"),
    });
    expect(userAsset).toBeDefined();
  });
});