import { describe, it, expect } from "vitest";
import { calculateYearsAheadOrBehind } from "./projection-utils";
import { createDecimalValueString } from "@shared/schema/utils";

describe("calculateYearsAheadOrBehind should return the correct number of years ahead or behind", () => {
  it("when the projected value at retirement is zero", () => {
    const shortfall = 100000;
    const targetRetirementAge = 65;
    const currentAge = 60;
    const projectedValueAtRetirement = createDecimalValueString("0");
    const yearsAheadOrBehind = calculateYearsAheadOrBehind(
      shortfall,
      targetRetirementAge,
      currentAge,
      projectedValueAtRetirement
    );
    expect(yearsAheadOrBehind).toBe(Infinity);
  });
});
