import numabbr from "numabbr";

export const formatYears = (value?: number) =>
  value !== undefined && Number.isFinite(value)
    ? `${Math.round(value)} years`
    : "—";

export const retirementStatusBadge = (ahead: boolean, behind: boolean) =>
  ahead ? "Ahead" : behind ? "Behind" : "On track";
export const retirementBadgeVariant = (ahead: boolean, behind: boolean) =>
  ahead ? "default" : behind ? "destructive" : "secondary";

export const formatGBPCompact = (value: number): string => {
  if (!Number.isFinite(value)) return "£0";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `£${numabbr(value)}`;
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
};
