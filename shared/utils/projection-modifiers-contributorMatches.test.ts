import { describe, it, expect } from "vitest";
import { contributorMatches } from "./projection-modifiers";
import type {
  Contributor,
  ContributorMatchPredicate,
} from "@shared/schema/projections";
import { createDecimalValueString } from "@shared/schema";

function minimalContributor(overrides: Partial<Contributor> = {}): Contributor {
  return {
    id: crypto.randomUUID(),
    name: "Test",
    type: "asset",
    accountType: "ISA",
    currentValue: createDecimalValueString("0"),
    schedules: [],
    includeValue: true,
    includeContributions: true,
    ...overrides,
  };
}

describe("contributorMatches", () => {
  it("should return true when match is undefined", () => {
    const contributor = minimalContributor({ accountType: "ISA" });
    expect(contributorMatches(contributor, undefined)).toBe(true);
  });

  it("should return true when match is empty object", () => {
    const contributor = minimalContributor({ accountType: "ISA" });
    expect(contributorMatches(contributor, {})).toBe(true);
  });

  it("should match contributor when accountType equals predicate string", () => {
    const contributor = minimalContributor({ accountType: "ISA" });
    const match: ContributorMatchPredicate = { accountType: "ISA" };
    expect(contributorMatches(contributor, match)).toBe(true);
  });

  it("should not match when accountType does not equal predicate string", () => {
    const contributor = minimalContributor({ accountType: "ISA" });
    const match: ContributorMatchPredicate = { accountType: "SIPP" };
    expect(contributorMatches(contributor, match)).toBe(false);
  });

  it("should match when contributor accountType is in predicate array", () => {
    const contributor = minimalContributor({ accountType: "LISA" });
    const match: ContributorMatchPredicate = {
      accountType: ["ISA", "LISA"],
    };
    expect(contributorMatches(contributor, match)).toBe(true);
  });

  it("should not match when contributor accountType is not in predicate array", () => {
    const contributor = minimalContributor({ accountType: "SIPP" });
    const match: ContributorMatchPredicate = {
      accountType: ["ISA", "LISA"],
    };
    expect(contributorMatches(contributor, match)).toBe(false);
  });

  it("should not match when contributor accountType is null and predicate has accountType", () => {
    const contributor = minimalContributor({ accountType: null });
    const match: ContributorMatchPredicate = { accountType: "ISA" };
    expect(contributorMatches(contributor, match)).toBe(false);
  });

  it("should match when contributorType equals predicate string", () => {
    const contributor = minimalContributor({ type: "asset" });
    const match: ContributorMatchPredicate = { contributorType: "asset" };
    expect(contributorMatches(contributor, match)).toBe(true);
  });

  it("should not match when contributorType does not equal predicate", () => {
    const contributor = minimalContributor({ type: "asset" });
    const match: ContributorMatchPredicate = {
      contributorType: "state_pension",
    };
    expect(contributorMatches(contributor, match)).toBe(false);
  });

  it("should match when referenceId equals predicate", () => {
    const refId = "a1b2c3d4-e5f6-4789-a012-345678901234";
    const contributor = minimalContributor({ referenceId: refId });
    const match: ContributorMatchPredicate = { referenceId: refId };
    expect(contributorMatches(contributor, match)).toBe(true);
  });

  it("should not match when referenceId does not equal predicate", () => {
    const contributor = minimalContributor({
      referenceId: "a1b2c3d4-e5f6-4789-a012-345678901234",
    });
    const match: ContributorMatchPredicate = {
      referenceId: "b2c3d4e5-f6a7-4890-b123-456789012345",
    };
    expect(contributorMatches(contributor, match)).toBe(false);
  });

  it("should not match when predicate has referenceId but contributor has none", () => {
    const contributor = minimalContributor(); // no referenceId
    const match: ContributorMatchPredicate = {
      referenceId: "a1b2c3d4-e5f6-4789-a012-345678901234",
    };
    expect(contributorMatches(contributor, match)).toBe(false);
  });

  it("should require all specified predicate fields to match", () => {
    const refId = "a1b2c3d4-e5f6-4789-a012-345678901234";
    const contributor = minimalContributor({
      accountType: "ISA",
      type: "asset",
      referenceId: refId,
    });
    expect(
      contributorMatches(contributor, {
        accountType: "ISA",
        contributorType: "asset",
        referenceId: refId,
      })
    ).toBe(true);
    expect(
      contributorMatches(contributor, {
        accountType: "ISA",
        contributorType: "state_pension",
        referenceId: refId,
      })
    ).toBe(false);
  });
});
