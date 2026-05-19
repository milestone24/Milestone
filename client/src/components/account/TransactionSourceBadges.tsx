import { Badge } from "@/components/ui/badge";
import { AssetTransaction, AssetTransactionFlagsInsert } from "@shared/schema";

type BadgeProps = {
  variant: "outline" | "secondary" | "destructive" | "default";
  label: string;
  className?: string;
};

// manual is outline/muted — it is the baseline expected state, least prominent
// recurring/ocr/import have a distinct background so they stand out from manual
const sourceLabels: Record<AssetTransaction["source"], BadgeProps> = {
  manual: { variant: "outline", label: "Manual", className: "bg-muted text-muted-foreground border-muted-foreground/30" },
  recurring: { variant: "secondary", label: "Recurring" },
  ocr: { variant: "secondary", label: "OCR" },
  import: { variant: "secondary", label: "Import" },
  dividend: { variant: "secondary", label: "Dividend" },
  "sipp-rebate": { variant: "secondary", label: "SIPP Rebate" },
  "cash-top-up": { variant: "secondary", label: "Cash Top-up" },
  "cash-withdrawal": { variant: "secondary", label: "Cash Withdrawal" },
};

const getFlagBadges = (flags: AssetTransactionFlagsInsert | null): BadgeProps[] => {
  if (!flags) return [];
  const result: BadgeProps[] = [];
  if (flags.estimated) result.push({ variant: "outline", label: "Estimated", className: "bg-amber-100 text-amber-700 border-amber-400 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-600" });
  if (flags.suspect) result.push({ variant: "destructive", label: "Suspect" });
  if (flags.verified) result.push({ variant: "outline", label: "Verified", className: "bg-green-100 text-green-700 border-green-400 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600" });
  return result;
};

type TransactionSourceBadgesProps = {
  source: AssetTransaction["source"];
  flags: AssetTransactionFlagsInsert | null;
};

export const TransactionSourceBadges = ({ source, flags }: TransactionSourceBadgesProps) => {
  const sourceBadge = sourceLabels[source];
  const flagBadges = getFlagBadges(flags);

  return (
    <>
      <Badge variant={sourceBadge.variant} className={sourceBadge.className}>
        {sourceBadge.label}
      </Badge>
      {flagBadges.map((badge) => (
        <Badge key={badge.label} variant={badge.variant} className={badge.className}>
          {badge.label}
        </Badge>
      ))}
    </>
  );
};
