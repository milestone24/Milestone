export const formatYears = (value?: number) =>
  value !== undefined && Number.isFinite(value)
    ? `${Math.round(value)} years`
    : "—";

export const formatGBPCompact = (value: number): string => {
  if (!Number.isFinite(value)) return "£0";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
};
