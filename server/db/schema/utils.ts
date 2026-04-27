import { decimal, timestamp } from "drizzle-orm/pg-core";
import {
  InferInsertModel as DrizzleInferInsertModel,
  sql,
  Table,
} from "drizzle-orm";

// Common timestamp columns
export const createdAtColumn = () => ({
  createdAt: timestamp("created_at").defaultNow(),
});
// Helper function to create an updatedAt column that automatically updates on row changes
export const updatedAtColumn = () => ({
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});

export const timestampColumns = () => ({
  ...createdAtColumn(),
  ...updatedAtColumn(),
});

// Wrapper type around drizzle's InferInsertModel that preserves all arguments
// Its purpose is to remove the custom cuid column from the inferred model as it the InferInsertModel
// does not support custom types
export type InferInsertModelBasic<
  TTable extends Table,
  TConfig extends {
    dbColumnNames: boolean;
    override?: boolean;
  } = {
    dbColumnNames: false;
    override: false;
  }
> = Omit<
  DrizzleInferInsertModel<TTable, TConfig>,
  "id" | "createdAt" | "updatedAt"
>;

export const slugify = (column: string) =>
  sql`regexp_replace(regexp_replace(regexp_replace(lower(${column}), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'), '-+', '-', 'g')`;

import { customType } from "drizzle-orm/pg-core"; // Or mysql-core, sqlite-core depending on your database
import z, { BRAND } from "zod";

//NOT USED ANYMORE, using Zod brands instead for easy cohesion with Zod schemas
// declare const decimalValueStringBrandSymbol: unique symbol;
// export type DecimalValueStringBrand = {
//   [decimalValueStringBrandSymbol]: void;
// };

//We need to do this in the db module because we need to use the brand symbol to create the schema type 'brandedDecimal'

export type DecimalValueStringBrand = BRAND<"DecimalValueString">;
//export type DecimalValueString = z.infer<typeof decimalValueSchema>;
export type DecimalValueString = string & DecimalValueStringBrand;
export const decimalValueSchema = z.string().brand<"DecimalValueString">();
export const decimalValueSchemaRequiredGreaterThanZero =
  decimalValueSchema.refine(
    (value) => value !== "" && value !== null && Number(value) > 0,
    {
      message: "Value is required and must be greater than 0",
    }
  );

/**
 * Branded decimal string that is valid and **not zero** (positive or negative).
 * Keep the string guard aligned with `isDecimalValueString` in `shared/schema/utils.ts`.
 */
export const decimalValueNonZeroSchema = decimalValueSchema.refine(
  (value) =>
    value !== "" &&
    value != null &&
    /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value) &&
    !Number.isNaN(parseFloat(value)) &&
    Number(value) !== 0,
  { message: "Amount must be a non-zero decimal" }
);

//Create a custom type for Drizzle
//NOT USED ANYMORE, used as simple approach using the $type<DecimalValueString> approach
// export const brandedDecimal = customType<{
//   data: DecimalValueString; // The TypeScript type for your application
//   driverData: string; // The type the database driver expects (usually string for decimal)
// }>({
//   dataType: () => "decimal(18, 2)", // Or your desired decimal precision and scale
//   fromDriver: (val) => val as DecimalValueString, // Cast the string from the driver to your branded type
//   toDriver: (val) => val, // Send the branded string directly to the driver
// });

export const brandedDecimal = (name: string) =>
  decimal(name, {
    precision: 18,
    scale: 2,
  }).$type<DecimalValueString>();
