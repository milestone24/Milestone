export type ValueAbstract = {
  value: number;
  valueDate: Date;
  //recordedAt: Date;
  //currentValue: number;
  //or
  //valueSum: number
};

export type ValueAbstractType = "asset_value" | "transaction";

export type BrandedValue<
  T extends ValueAbstract,
  B extends ValueAbstractType
> = T & {
  recordType: B;
};
