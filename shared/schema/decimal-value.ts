import {
  DecimalValueString as DBDecimalValueString,
  decimalValueSchema,
} from "@server/db/schema/utils";

export { decimalValueSchema } from "@server/db/schema/utils";

/**
 * Returns a Zod refine predicate that passes only when the decimal string has at most
 * `maxPlaces` digits after the decimal point. Intended for share quantity fields to
 * align client-side validation with the `brandedDecimalQuantity` column scale (8).
 *
 * @example
 * value: decimalValueNonZeroSchema.refine(
 *   maxDecimalPlaces(8),
 *   { message: "Share quantity must not exceed 8 decimal places" }
 * )
 */
export const maxDecimalPlaces = (maxPlaces: number) => (value: string | undefined) => {
  if (!value) return true;
  const parts = value.split(".");
  return parts.length === 1 || (parts[1]?.length ?? 0) <= maxPlaces;
};

export const isDecimal = (value: string) => {
  return value !== "" && value !== null
    ? isDecimalValueString(value)
    : false;
};

// Define the branded type for a float string
export type DecimalValueString = DBDecimalValueString;

const decimalValueRegex = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/;

// A type guard function to check if a string is a valid float string
// null or undefined are not valid decimal value strings
export function isDecimalValueString(
  value: string
): value is DecimalValueString {
  // Use a regular expression to validate the format of a float string
  // This regex allows for optional sign, digits, optional decimal point with digits
  return decimalValueRegex.test(value) && !isNaN(parseFloat(value));
}

// A function to create a branded FloatString from a regular string
export function createDecimalValueString(value: string): DecimalValueString {
  if (!isDecimalValueString(value)) {
    throw new Error(`"${value}" is not a valid decimal string.`);
  }
  return value as DecimalValueString;
}


const isNullOrUndefined = (value: string | null | undefined) => value === null || value === undefined;

/**
 * Branded decimal string that is valid and **not zero** (positive or negative).
 * Keep the string guard aligned with `isDecimalValueString` in `shared/schema/utils.ts`.
 */
export const decimalValueNonZeroSchema = decimalValueSchema
  //.transform((value) => value === "" ? undefined : value)
  .refine(
    (value) =>
      //We deliberately allow null, and undefined values to pass through to the next refine
      //We let the zod use case define if the value is required or optional to handle the error message
      isNullOrUndefined(value)
        ? false
        : value != "" && isDecimalValueString(value) &&
        Number(value) !== 0,
    { message: "Value must be a decimal number and be not zero" }
  );

export const decimalValueZeroOrGreaterSchema = decimalValueSchema
  //.transform((value) => value === "" ? undefined : value)
  .refine(
    (value) =>
      //We deliberately allow null, and undefined values to pass through to the next refine
      //We let the zod use case define if the value is required or optional to handle the error message
      isNullOrUndefined(value)
        ? false
        : value != "" && isDecimalValueString(value) &&
        Number(value) >= 0,
    { message: "Value must be a decimal number and be zero or greater" }
  );

export const decimalValueSchemaGreaterThanZero =
  decimalValueSchema
    //.transform((value) => value === "" ? undefined : value)
    .refine(
      (value) =>
        //We deliberately allow null, and undefined values to pass through to the next refine
        //We let the zod use case define if the value is required or optional to handle the error message
        isNullOrUndefined(value)
          ? false
          : value !== "" && isDecimalValueString(value) &&
          Number(value) > 0,
      {
        message: "Value must a decimal number and be greater than 0",
      }
    );

const cuurencyValueDecimalPlacesMessage = "Currency value must not exceed 2 decimal places";

export const currencyNonZeroSchema = decimalValueNonZeroSchema
  .refine(maxDecimalPlaces(2), { message: cuurencyValueDecimalPlacesMessage });

export const currencyZeroOrGreaterSchema = decimalValueZeroOrGreaterSchema
  .refine(maxDecimalPlaces(2), { message: cuurencyValueDecimalPlacesMessage });

export const currencyGreaterThanZeroSchema = decimalValueSchemaGreaterThanZero
  .refine(maxDecimalPlaces(2), { message: cuurencyValueDecimalPlacesMessage });

export const shareQuantityDecimalPlacesMessage = "Share quantity must not exceed 8 decimal places";

export const shareQuantityNoneZeroSchema = decimalValueNonZeroSchema
  .refine(
    maxDecimalPlaces(8),
    { message: shareQuantityDecimalPlacesMessage }
  );
export const shareQuantityGreaterThanZeroSchema = decimalValueSchemaGreaterThanZero
  .refine(maxDecimalPlaces(8), { message: shareQuantityDecimalPlacesMessage });

const shareValueDecimalPlacesMessage = "Share value must not exceed 4 decimal places";

export const shareValueNoneZeroSchema = decimalValueNonZeroSchema
  .refine(maxDecimalPlaces(4), { message: shareValueDecimalPlacesMessage });

export const shareValueGreaterThanZeroSchema = decimalValueSchemaGreaterThanZero
  .refine(maxDecimalPlaces(4), { message: shareValueDecimalPlacesMessage });