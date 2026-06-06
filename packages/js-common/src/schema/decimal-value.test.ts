import { currencyNonZeroSchema, currencyGreaterThanZeroSchema, shareQuantityGreaterThanZeroSchema, shareQuantityNoneZeroSchema } from "./decimal-value";
import { describe, it, expect } from "vitest";
import { z } from "zod";
import util from "node:util";

const testOptionalAndNullable = (optionalsSchema: z.ZodSchema) => () => {
  it("safe parse should succeed if the value undefined on optional field", () => {

    const schema = z.object({
      valueOne: optionalsSchema.optional(),
    })

    const result = schema.safeParse({
      valueOne: undefined,
    });

    expect(result.success).toBe(true);
  });

  it.only("safe parse should fail if the value undefined on non optional field", () => {

    const schema = z.object({
      valueOne: optionalsSchema,
    })

    const result = schema.safeParse({
      valueOne: undefined,
    });

    expect(result.success).toBe(false);
  });


  it("safe parse should fail if the value is null on optional field", () => {

    const schema = z.object({
      valueOne: optionalsSchema.optional(),
    })

    const result = schema.safeParse({
      valueOne: null,
    });

    expect(result.success).toBe(false);
  });

  it("safe parse should succeed if the value is null on nullable field", () => {
    const schema = z.object({
      valueOne: optionalsSchema.nullable(),
    })
    const result = schema.safeParse({
      valueOne: null,
    });

    expect(result.success).toBe(true);
  });

  it("safe parse should fail if the value is an empty string", () => {
    const schema = z.object({
      valueOne: optionalsSchema,
    })
    const result = schema.safeParse({
      valueOne: "",
    });

    console.log("result 5", result);

    expect(result.success).toBe(false);
  });
};


const testNonZero = (nonZeroSchema: z.ZodSchema) => () => {

  it("safe parse should fail if the value is zero", () => {
    const schema = z.object({
      value: nonZeroSchema
    })
    const result = schema.safeParse({ value: "0" });
    expect(result.success).toBe(false);
  });

  it("safe parse should succeed if the value is greater than zero", () => {
    const schema = z.object({
      value: nonZeroSchema
    })
    const result = schema.safeParse({ value: "1" });
    expect(result.success).toBe(true);
  });

  it("safe parse should succeed if the value is less than zero", () => {
    const schema = z.object({
      value: nonZeroSchema
    })
    const result = schema.safeParse({ value: "-1" });
    expect(result.success).toBe(true);
  });
};

const testGreaterThanZero = (greaterThanZeroSchema: z.ZodSchema) => () => {
  it("safe parse should fail if the value is zero", () => {
    const schema = z.object({
      value: greaterThanZeroSchema
    })
    const result = schema.safeParse({ value: "0" });
    expect(result.success).toBe(false);
  });

  it("safe parse should succeed if the value is greater than zero", () => {
    const schema = z.object({
      value: greaterThanZeroSchema
    })
    const result = schema.safeParse({ value: "1" });
    expect(result.success).toBe(true);
  });

  it("safe parse should fail if the value is less than zero", () => {
    const schema = z.object({
      value: greaterThanZeroSchema
    })
    const result = schema.safeParse({ value: "-1" });
    expect(result.success).toBe(false);
  });
};

const generateFixedLengthNumber = (len: number) => {
  const min = Math.pow(10, len - 1);
  const max = Math.pow(10, len) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const testDecimalPlaces = (decimalsSchema: z.ZodSchema, decimalsLimit: number) => () => {

  //We craete a numbers array where the ;ast number length exceeds decimal places limit
  const numbers = Array
    .from({ length: decimalsLimit + 1 }, (_, i) => generateFixedLengthNumber(i + 1))

  numbers.forEach((number, index) => {

    const numberString = number.toString();
    const numberLength = numberString.length;
    const numberWithDecimal = `1.${numberString}`;

    if (index < numbers.length - 1) {
      it(`safe parse should succeed if the value is a valid currency decimal value with ${numberLength} decimal places`, () => {
        const schema = z.object({
          value: decimalsSchema
        })
        const result = schema.safeParse({ value: numberWithDecimal });
        expect(result.success).toBe(true);
      });
    } else {
      it(`safe parse should fail if the value is a valid currency decimal value with ${numberLength} decimal places`, () => {
        const schema = z.object({
          value: decimalsSchema
        })
        const result = schema.safeParse({ value: numberWithDecimal });
      });
    }
  });
}

describe("currency non zero", testNonZero(currencyNonZeroSchema));
describe("share quantity non zero", testNonZero(shareQuantityNoneZeroSchema));
describe("currency greater than zero", testGreaterThanZero(currencyGreaterThanZeroSchema));
describe("share quantity greater than zero", testGreaterThanZero(shareQuantityGreaterThanZeroSchema));

describe.only("currency none zero optional", testOptionalAndNullable(currencyNonZeroSchema));
describe("currency greater than zero optional", testOptionalAndNullable(currencyGreaterThanZeroSchema));
describe("share quantity non zero optional", testOptionalAndNullable(shareQuantityNoneZeroSchema));
describe("share quantity greater than zero optional", testOptionalAndNullable(shareQuantityGreaterThanZeroSchema));

describe("currency non zero decimal places", testDecimalPlaces(currencyNonZeroSchema, 2))
describe("currency greater than zero decimal places", testDecimalPlaces(currencyGreaterThanZeroSchema, 2))
describe("share quantity non zero decimal places", testDecimalPlaces(shareQuantityNoneZeroSchema, 8))
describe("share quantity greater than zero decimal places", testDecimalPlaces(shareQuantityGreaterThanZeroSchema, 8))