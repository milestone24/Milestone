// @ts-nocheck

//This test needs modifying to use the new SecurityCacheUpdater Event Emitter

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  bulkPopulateSecurityDailyHistory,
  populateSecuritiesDailyHistoryCache,
} from "./cache";
// import {
//   populateSecurityDailyHistory,
//   bulkPopulateSecurityDailyHistory,
//   calculateAssetValueForDate,
//   populateAssetValuesForDateRange,
//   onSecuritiesUpdated,
//   bulkSyncAllAutomatedAssets
// } from './index'

import { factory } from "./asset-value";
import { EventEmitter } from "events";

const assetValue = factory();

describe("Securities Sync Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // DAILY HISTORY CACHING TESTS
  // ============================================================================

  describe("populateSecurityDailyHistory", () => {
    it("should populate daily history for a single security", async () => {
      // TODO: Implement test
      await expect(
        populateSecuritiesDailyHistoryCache(
          [
            {
              securityId: "security-id-1",
              startDate: new Date("2024-01-01"),
            },
          ],
          "job-id",
          new AbortSignal(),
          new EventEmitter()
        )
      ).rejects.toThrow("Not implemented");
    });

    it("should handle missing price data gracefully", async () => {
      // TODO: Implement test
    });

    it("should skip already cached dates", async () => {
      // TODO: Implement test
    });

    it("should track API source usage", async () => {
      // TODO: Implement test
    });
  });

  describe("bulkPopulateSecurityDailyHistory", () => {
    it("should process multiple securities in parallel", async () => {
      // TODO: Implement test
      await expect(
        bulkPopulateSecurityDailyHistory([
          {
            securityId: "security-1",
            startDate: new Date("2024-01-01"),
          },
          {
            securityId: "security-2",
            startDate: new Date("2024-01-01"),
          },
        ])
      ).rejects.toThrow("Not implemented");
    });

    it("should handle partial failures gracefully", async () => {
      // TODO: Implement test
    });
  });

  // ============================================================================
  // ASSET VALUE CALCULATION TESTS
  // ============================================================================

  describe("calculateAssetValueForDate", () => {
    it("should calculate asset value using cached prices", async () => {
      // TODO: Implement test
      await expect(
        assetValue.calculateAssetValueForDateFromCache(
          [],
          new Date("2024-01-15")
        )
      ).rejects.toThrow("Not implemented");
    });

    it("should handle missing securities gracefully", async () => {
      // TODO: Implement test
    });

    it("should generate comprehensive metadata", async () => {
      // TODO: Implement test
    });

    it("should track data quality and sources", async () => {
      // TODO: Implement test
    });
  });
});
