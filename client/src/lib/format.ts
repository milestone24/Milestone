export const formatYears = (value?: number) =>
  value !== undefined && Number.isFinite(value)
    ? `${Math.round(value)} years`
    : "—";

export const retirementStatusBadge = (ahead: boolean, behind: boolean) =>
  ahead ? "Ahead" : behind ? "Behind" : "On track";
export const retirementBadgeVariant = (ahead: boolean, behind: boolean) =>
  ahead ? "default" : behind ? "destructive" : "secondary";
