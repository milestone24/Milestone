import { z } from "zod";
import { decimalValueSchema } from "@milestone/data/schema/utils";
import { DecimalValueString } from "./decimal-value";

export type ValueAbstract = {
  value: DecimalValueString;
  valueDate: Date;
  //recordedAt: Date;
  //currentValue: number;
  //or
  //valueSum: number
};

export const valueAbstractSchema = z.object({
  value: decimalValueSchema,
  valueDate: z.coerce.date(),
});

valueAbstractSchema._output satisfies ValueAbstract;

export type ValueAbstractType = "asset_value" | "transaction";

export type BrandedValue<
  T extends ValueAbstract,
  B extends ValueAbstractType
> = T & {
  recordType: B;
};
