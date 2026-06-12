import { describe, it, expect } from "vitest";
import {
  createModifierChain,
  createModifierContext,
  ContributionOffsetModifier,
} from "./projection-modifiers";
import { createDecimalValueString } from "../schema";

describe("ContributionOffsetModifier", () => {
  it("should add amount to value when enabled and contributionAmount in context", () => {
    const modifier = new ContributionOffsetModifier({
      type: "contribution_offset",
      enabled: true,
      amount: createDecimalValueString("100"),
    });
    const context = createModifierContext(
      createDecimalValueString("1000"),
      new Date("2025-01-01"),
      new Date("2025-06-01"),
      createDecimalValueString("500")
    );
    const result = modifier.apply(createDecimalValueString("500"), context);
    expect(result).toBe("600");
  });

  it("should subtract when amount is negative", () => {
    const modifier = new ContributionOffsetModifier({
      type: "contribution_offset",
      enabled: true,
      amount: createDecimalValueString("-50"),
    });
    const context = createModifierContext(
      createDecimalValueString("1000"),
      new Date("2025-01-01"),
      new Date("2025-06-01"),
      createDecimalValueString("200")
    );
    const result = modifier.apply(createDecimalValueString("200"), context);
    expect(result).toBe("150");
  });

  it("should return value unchanged when disabled", () => {
    const modifier = new ContributionOffsetModifier({
      type: "contribution_offset",
      enabled: false,
      amount: createDecimalValueString("100"),
    });
    const context = createModifierContext(
      createDecimalValueString("1000"),
      new Date("2025-01-01"),
      new Date("2025-06-01"),
      createDecimalValueString("500")
    );
    const result = modifier.apply(createDecimalValueString("500"), context);
    expect(result).toBe("500");
  });

  it("should return value unchanged when contributionAmount not in context", () => {
    const modifier = new ContributionOffsetModifier({
      type: "contribution_offset",
      enabled: true,
      amount: createDecimalValueString("100"),
    });
    const context = createModifierContext(
      createDecimalValueString("1000"),
      new Date("2025-01-01"),
      new Date("2025-06-01")
      // no contributionAmount
    );
    const result = modifier.apply(createDecimalValueString("500"), context);
    expect(result).toBe("500");
  });

  it("should return correct getName with positive amount", () => {
    const modifier = new ContributionOffsetModifier({
      type: "contribution_offset",
      enabled: true,
      amount: createDecimalValueString("100"),
    });
    expect(modifier.getName()).toContain("+100");
  });

  it("should return correct getName with negative amount", () => {
    const modifier = new ContributionOffsetModifier({
      type: "contribution_offset",
      enabled: true,
      amount: createDecimalValueString("-25"),
    });
    expect(modifier.getName()).toContain("-25");
  });

  it("isEnabled should reflect config", () => {
    expect(
      new ContributionOffsetModifier({
        type: "contribution_offset",
        enabled: true,
        amount: createDecimalValueString("0"),
      }).isEnabled()
    ).toBe(true);
    expect(
      new ContributionOffsetModifier({
        type: "contribution_offset",
        enabled: false,
        amount: createDecimalValueString("0"),
      }).isEnabled()
    ).toBe(false);
  });
});

describe("createModifierChain with contribution_offset", () => {
  it("should apply contribution_offset when building chain from config", () => {
    const chain = createModifierChain([
      {
        type: "contribution_offset",
        enabled: true,
        amount: createDecimalValueString("100"),
      },
    ]);
    const context = createModifierContext(
      createDecimalValueString("0"),
      new Date("2025-01-01"),
      new Date("2025-06-01"),
      createDecimalValueString("300")
    );
    const result = chain.apply(createDecimalValueString("300"), context);
    expect(result).toBe("400");
  });

  it("should apply contribution_offset in sequence with other contribution-level modifiers", () => {
    const chain = createModifierChain([
      { type: "tax", enabled: true, rate: 20 },
      {
        type: "contribution_offset",
        enabled: true,
        amount: createDecimalValueString("50"),
      },
    ]);
    const context = createModifierContext(
      createDecimalValueString("0"),
      new Date("2025-01-01"),
      new Date("2025-06-01"),
      createDecimalValueString("100")
    );
    // 100 after 20% tax = 80; then +50 = 130
    const result = chain.apply(createDecimalValueString("100"), context);
    expect(result).toBe("130");
  });
});
