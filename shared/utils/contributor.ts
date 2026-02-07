import { Contributor, ContributorSchedule, createDecimalValueString, DecimalValueString } from "@shared/schema";
import Decimal from "decimal.js";

const MONTHLY_SCHEDULE_EXPRESSION = "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1";

export const iSingleMonthlyContributor = (c: Contributor): boolean =>
  c.schedules.length === 1
  && c.schedules?.[0]?.patternConfig?.type === "rrule"
  && c.schedules?.[0]?.patternConfig?.expression === MONTHLY_SCHEDULE_EXPRESSION;

export const montlyScheduleWithValue = (value: number | DecimalValueString): ContributorSchedule => ({
  value: typeof value === "number"
    ? createDecimalValueString(Decimal(value).toString())
    : value,
  patternConfig: { type: "rrule", expression: MONTHLY_SCHEDULE_EXPRESSION },
  startDate: new Date(),
  endDate: null,
});

export const contributorFromPreset = (
  preset: ContributorPreset,
): Contributor => ({
  name: preset.name,
  accountType: preset.accountType,
  type: preset.type,
  schedules: [montlyScheduleWithValue(preset.monthlyAmount)],
  includeContributions: true,
  includeValue: true,
  currentValue: createDecimalValueString("0"),
});

type ContributorPreset = Omit<Contributor, "schedules"> & {
  monthlyAmount: number;
};

export const singleMonthlyContributorAmount = (c: Contributor): number => {
  if (c.schedules.length === 0) {
    return 0;
  }
  if (!iSingleMonthlyContributor(c)) {
    throw new Error("Contributor is not a singleton");
  }
  return Number(c.schedules?.[0]?.value ?? createDecimalValueString("0"));
}

export const presets: Array<ContributorPreset> = [
  {
    name: "LISA £100/mo",
    accountType: "LISA",
    type: "asset",
    monthlyAmount: 100,
    includeContributions: true,
    includeValue: true,
    currentValue: createDecimalValueString("0"),
  },
  {
    name: "SIPP £200/mo",
    accountType: "SIPP",
    type: "asset",
    monthlyAmount: 200,
    currentValue: createDecimalValueString("0"),
    includeContributions: true,
    includeValue: true,
  },
  {
    name: "ISA £150/mo",
    accountType: "ISA",
    type: "asset",
    monthlyAmount: 150,
    currentValue: createDecimalValueString("0"),
    includeContributions: true,
    includeValue: true,
  },
  {
    name: "Workplace Pension £250/mo",
    //TODO a workplace pension should not have to be a CISA
    accountType: null,
    type: "workplace_pension",
    monthlyAmount: 250,
    currentValue: createDecimalValueString("0"),
    includeContributions: true,
    includeValue: true,
  },
];

export const contributionModifierPresets: Array<{ label: string; scale: number }> = [
  { label: "50%", scale: 0.5 },
  { label: "75%", scale: 0.75 },
  { label: "100%", scale: 1 },
  { label: "150%", scale: 1.5 },
  { label: "200%", scale: 2 },
];