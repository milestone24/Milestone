import { describe, it, expect } from "vitest";
import {
  unifyModifiersForContributor,
  getModifiersAsGlobalList,
} from "./projection-modifiers";
import type { Contributor, ModifierWithOptionalMatch } from "../schema/projections";
import { createDecimalValueString } from "../schema";

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

describe("unifyModifiersForContributor", () => {
  it("should return all modifiers when none have match", () => {
    const contributor = minimalContributor({ accountType: "ISA" });
    const entries: ModifierWithOptionalMatch[] = [
      { type: "tax", enabled: true, rate: 20 },
      { type: "inflation", enabled: true, rate: 2 },
    ];
    const result = unifyModifiersForContributor(contributor, entries);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "tax", enabled: true, rate: 20 });
    expect(result[1]).toEqual({ type: "inflation", enabled: true, rate: 2 });
  });

  it("should filter out modifiers whose match does not match contributor", () => {
    const contributor = minimalContributor({ accountType: "ISA" });
    const entries: ModifierWithOptionalMatch[] = [
      { type: "tax", enabled: true, rate: 20 },
      {
        type: "contribution_scaler",
        enabled: true,
        scaleFactor: 1.2,
        match: { accountType: "SIPP" },
      },
    ];
    const result = unifyModifiersForContributor(contributor, entries);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "tax", enabled: true, rate: 20 });
  });

  it("should include modifiers whose match matches contributor", () => {
    const contributor = minimalContributor({ accountType: "ISA" });
    const entries: ModifierWithOptionalMatch[] = [
      {
        type: "contribution_offset",
        enabled: true,
        amount: createDecimalValueString("100"),
        match: { accountType: "ISA" },
      },
    ];
    const result = unifyModifiersForContributor(contributor, entries);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "contribution_offset",
      enabled: true,
      amount: "100",
    });
    expect(result[0]).not.toHaveProperty("match");
  });

  it("should deduplicate singular modifier types (inflation)", () => {
    const contributor = minimalContributor();
    const entries: ModifierWithOptionalMatch[] = [
      { type: "inflation", enabled: true, rate: 2 },
      { type: "inflation", enabled: true, rate: 3 },
    ];
    const result = unifyModifiersForContributor(contributor, entries);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "inflation", rate: 2 });
  });

  it("should preserve order of modifiers", () => {
    const contributor = minimalContributor({ accountType: "ISA" });
    const entries: ModifierWithOptionalMatch[] = [
      { type: "tax", enabled: true, rate: 20 },
      {
        type: "contribution_offset",
        enabled: true,
        amount: createDecimalValueString("50"),
        match: { accountType: "ISA" },
      },
      { type: "fee", enabled: true, annualRate: 0.5 },
    ];
    const result = unifyModifiersForContributor(contributor, entries);
    expect(result.map((m) => m.type)).toEqual([
      "tax",
      "contribution_offset",
      "fee",
    ]);
  });
});

describe("getModifiersAsGlobalList", () => {
  it("should strip match from all entries and return plain modifiers", () => {
    const entries: ModifierWithOptionalMatch[] = [
      {
        type: "contribution_offset",
        enabled: true,
        amount: createDecimalValueString("100"),
        match: { accountType: "ISA" },
      },
    ];
    const result = getModifiersAsGlobalList(entries);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "contribution_offset",
      enabled: true,
      amount: "100",
    });
    expect(result[0]).not.toHaveProperty("match");
  });

  it("should deduplicate singular modifier types (inflation)", () => {
    const entries: ModifierWithOptionalMatch[] = [
      { type: "inflation", enabled: true, rate: 2 },
      { type: "inflation", enabled: true, rate: 3 },
    ];
    const result = getModifiersAsGlobalList(entries);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "inflation", rate: 2 });
  });
});
