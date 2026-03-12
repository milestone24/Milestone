import { Card, CardContent } from "@/components/ui/card";
import type { FireAccountSummary } from "@/hooks/use-fire";

const ACCOUNT_TYPE_BG: Record<string, string> = {
  ISA: "bg-isa",
  SIPP: "bg-sipp",
  LISA: "bg-lisa",
  GIA: "bg-gia",
  OTHER: "bg-other",
  PENSION: "bg-pension",
};

const FALLBACK_BG = "bg-primary";

const getAccountBgClass = (accountType: string): string =>
  ACCOUNT_TYPE_BG[accountType.toUpperCase()] ?? FALLBACK_BG;

const formatGBP0 = (value: number): string =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);

type FireAccountsSummaryCardProps = {
  accounts: FireAccountSummary[];
};

export function FireAccountsSummaryCard({
  accounts,
}: FireAccountsSummaryCardProps) {
  if (!accounts.length) return null;

  return (
    <Card className="mt-4 rounded-3xl border-border/40 bg-card/95 shadow-sm">
      <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Your accounts</h3>
          <p className="text-xs text-muted-foreground">
            Projected values at your FIRE date
          </p>
        </div>

        <div className="space-y-2">
          {accounts.map((account) => {
            const bgClass = getAccountBgClass(account.accountType);

            return (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-2xl bg-background/40 px-3 py-3 sm:px-4 sm:py-3.5"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold text-white sm:h-11 sm:w-11 ${bgClass}`}
                    aria-hidden
                  >
                    {account.platformInitial}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium leading-tight">
                      {account.providerName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {account.accountType} · {formatGBP0(account.monthlyContribution)}
                      /month · {account.lockLabel}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-base font-semibold sm:text-lg">
                    {formatGBP0(account.contributionsToDate)}
                  </div>
                  <div className="text-xs font-medium text-primary">
                    → {formatGBP0(account.projectedValueAtRetirement)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

