export {
  formatGBPCompact,
  formatYears,
} from "@milestone/js-common/utils/format";

export const retirementStatusBadge = (ahead: boolean, behind: boolean) =>
  ahead ? "Ahead" : behind ? "Behind" : "On track";

export const retirementBadgeVariant = (ahead: boolean, behind: boolean) =>
  ahead ? "default" : behind ? "destructive" : "secondary";
