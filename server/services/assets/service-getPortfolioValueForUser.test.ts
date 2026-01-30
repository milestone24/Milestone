

import { db } from "@server/db";
import { describe, expect, test } from "vitest";
import { DatabaseAssetService } from "./database";

describe("getPortfolioValueForUser", () => {
  test("should return the portfolio value for a user", async () => {
    const service = new DatabaseAssetService(db);
    const value = await service.getPortfolioValueForUser("5d4f0f7f-723c-4296-a4cf-d4a7e41db225");
    expect(value).toBe(100);
  });
});