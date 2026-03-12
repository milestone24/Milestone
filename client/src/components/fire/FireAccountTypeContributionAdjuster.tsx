import * as SliderPrimitive from "@radix-ui/react-slider";
import { RefreshCw, AlertCircle, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FireProjection, FireProjectionData } from "@shared/schema/projections";

// ============================================================================
// COLOUR MAPS — reuse tokens already defined in FireHeroLegend
// ============================================================================

const ACCOUNT_TYPE_BG: Record<string, string> = {
  ISA: "bg-isa",
  SIPP: "bg-sipp",
  LISA: "bg-lisa",
  GIA: "bg-gia",
  OTHER: "bg-other",
  PENSION: "bg-pension",
};

const ACCOUNT_TYPE_TEXT: Record<string, string> = {
  ISA: "text-isa",
  SIPP: "text-sipp",
  LISA: "text-lisa",
  GIA: "text-gia",
  OTHER: "text-other",
  PENSION: "text-pension",
};

const FALLBACK_BG = "bg-primary";
const FALLBACK_TEXT = "text-primary";

const getColorBg = (accountType: string) =>
  ACCOUNT_TYPE_BG[accountType.toUpperCase()] ?? FALLBACK_BG;

const getColorText = (accountType: string) =>
  ACCOUNT_TYPE_TEXT[accountType.toUpperCase()] ?? FALLBACK_TEXT;

// ============================================================================
// HELPERS
// ============================================================================

const formatGBP = (value: number): string =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);

const SLIDER_STEP = 25;

const sliderMaxForBaseline = (baseline: number) =>
  Math.max(Math.ceil((baseline * 2 + 200) / SLIDER_STEP) * SLIDER_STEP, 500);

// ============================================================================
// TYPES
// ============================================================================

export type AccountTypeRowData = {
  accountType: string;
  baselineMonthly: number;
  totalContributors: number;
  contributorsWithSchedules: number;
};

type Props = {
  projection: FireProjection;
  baselineProjection: FireProjection | undefined;
  accountTypeRows: AccountTypeRowData[];
  offsets: Map<string, number>;
  onChangeOffset: (accountType: string, delta: number) => void;
  onReset: () => void;
};

// ============================================================================
// SPARKLINE
// ============================================================================

function Sparkline({ data }: { data: FireProjectionData[] }) {
  const points = useMemo(() => {
    if (data.length < 2) return "";
    const portfolioValues = data.map((d) => Number(d.portfolio));
    const min = Math.min(...portfolioValues);
    const max = Math.max(...portfolioValues);
    const range = max - min || 1;
    const w = 100;
    const h = 40;
    return portfolioValues
      .map((v, i) => {
        const x = (i / (portfolioValues.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data]);

  if (!points) return null;

  return (
    <svg
      viewBox="0 0 100 40"
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <path
        d={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
    </svg>
  );
}

// ============================================================================
// ACCOUNT TYPE ROW SLIDER
// ============================================================================

type AccountTypeSliderProps = {
  accountType: string;
  baseline: number;
  value: number;
  disabled: boolean;
  onChangeValue: (value: number) => void;
};

function AccountTypeSlider({
  accountType,
  baseline,
  value,
  disabled,
  onChangeValue,
}: AccountTypeSliderProps) {
  const max = sliderMaxForBaseline(baseline);
  const bgClass = getColorBg(accountType);
  const nowPct = max > 0 ? ((baseline / max) * 100).toFixed(1) : "0";

  return (
    <div className="relative w-full">
      {/* NOW label */}
      <div
        className="absolute -top-5 text-[10px] text-muted-foreground leading-none"
        style={{ left: `${nowPct}%`, transform: "translateX(-50%)" }}
      >
        NOW
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={disabled}
          onClick={() => onChangeValue(Math.max(0, value - SLIDER_STEP))}
          aria-label={`Decrease ${accountType} contribution`}
        >
          −
        </Button>

        {/* Custom Radix slider: light track, account colour fill left of thumb, white thumb */}
        <SliderPrimitive.Root
          className="relative flex w-full touch-none select-none items-center"
          min={0}
          max={max}
          step={SLIDER_STEP}
          value={[value]}
          disabled={disabled}
          onValueChange={(values) => {
            if (values[0] !== undefined) onChangeValue(values[0]);
          }}
        >
          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
            <SliderPrimitive.Range className={`absolute h-full ${bgClass}`} />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-card bg-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
        </SliderPrimitive.Root>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={disabled}
          onClick={() => onChangeValue(Math.min(max, value + SLIDER_STEP))}
          aria-label={`Increase ${accountType} contribution`}
        >
          +
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// WARNING BADGE + DIALOG
// ============================================================================

type WarningDialogProps = {
  accountType: string;
  warningType: "no_schedules" | "partial_schedules";
};

function WarningBadge({ accountType, warningType }: WarningDialogProps) {
  const title =
    warningType === "no_schedules"
      ? `No recurring contributions for ${accountType}`
      : `Partial recurring contributions for ${accountType}`;

  const description =
    warningType === "no_schedules"
      ? `You have ${accountType} assets but none have recurring contributions set up. Add a recurring contribution to adjust this account type's projection.`
      : `Some of your ${accountType} assets do not have recurring contributions. This slider only affects the assets that do have scheduled contributions.`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Badge
          variant="outline"
          className="cursor-pointer gap-1 text-amber-500 border-amber-500/40 hover:bg-amber-500/10"
        >
          <AlertCircle className="h-3 w-3" />
          {warningType === "no_schedules" ? "No contributions" : "Partial"}
        </Badge>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ACCOUNT TYPE ROW
// ============================================================================

type AccountTypeRowProps = {
  row: AccountTypeRowData;
  currentValue: number;
  onChangeValue: (v: number) => void;
};

function AccountTypeRow({ row, currentValue, onChangeValue }: AccountTypeRowProps) {
  const { accountType, baselineMonthly, totalContributors, contributorsWithSchedules } = row;
  const isDisabled = contributorsWithSchedules === 0;
  const hasPartial = contributorsWithSchedules > 0 && contributorsWithSchedules < totalContributors;
  const showWarning = isDisabled || hasPartial;
  const warningType: "no_schedules" | "partial_schedules" =
    isDisabled ? "no_schedules" : "partial_schedules";

  const dotClass = getColorBg(accountType);
  const textClass = getColorText(accountType);
  const isLISA = accountType.toUpperCase() === "LISA";

  return (
    <div className="flex flex-col gap-3 py-3 border-t border-border first:border-0">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotClass}`} />
          <span className="text-sm font-medium">{accountType}</span>
          {isLISA && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              +25% gov bonus
            </Badge>
          )}
          {showWarning && (
            <WarningBadge accountType={accountType} warningType={warningType} />
          )}
        </div>
        <span className={`text-sm font-semibold tabular-nums ${textClass}`}>
          {formatGBP(currentValue)}/mo
        </span>
      </div>

      {/* Slider */}
      <AccountTypeSlider
        accountType={accountType}
        baseline={baselineMonthly}
        value={currentValue}
        disabled={isDisabled}
        onChangeValue={onChangeValue}
      />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FireAccountTypeContributionAdjuster({
  projection,
  baselineProjection,
  accountTypeRows,
  offsets,
  onChangeOffset,
  onReset,
}: Props) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const projectedAge = projection.projectedRetirementAge;

  // Delta between baseline and preview projection in months (rounded)
  const monthsDelta = useMemo(() => {
    if (
      !baselineProjection?.projectedRetirementAge ||
      !projectedAge ||
      offsets.size === 0
    ) {
      return null;
    }
    return Math.round(
      (baselineProjection.projectedRetirementAge - projectedAge) * 12
    );
  }, [baselineProjection, projectedAge, offsets]);

  const total = useMemo(() => {
    return accountTypeRows.reduce((sum, row) => {
      const offset = offsets.get(row.accountType) ?? 0;
      return sum + row.baselineMonthly + offset;
    }, 0);
  }, [accountTypeRows, offsets]);

  const hasAnyOffset = offsets.size > 0;

  const suggestionContent = useMemo(() => {
    if (projectedAge === null) return null;

    const diff = projection.monthlyContributionDifference;
    const needed = diff ? Number(diff.monthlyContributionDifference) : 0;

    if (needed <= 0) {
      return (
        <>
          You're on track to retire at <strong>age {projectedAge}</strong> 🦉
        </>
      );
    }

    const suggestRow = accountTypeRows.find((r) => r.contributorsWithSchedules > 0);
    if (suggestRow) {
      const amount = Math.ceil(Math.abs(needed) / 25) * 25;
      return (
        <>
          You're on track to retire at <strong>age {projectedAge}</strong> 🦉 Add{" "}
          {formatGBP(amount)}/month to your {suggestRow.accountType} and you could get
          there <strong>sooner</strong>. Test different contributions below.
        </>
      );
    }

    return (
      <>
        You're on track to retire at <strong>age {projectedAge}</strong> 🦉 Test
        different contributions below.
      </>
    );
  }, [projection, projectedAge, accountTypeRows]);

  if (accountTypeRows.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-0">
        {/* Header */}
        <div className="flex items-start justify-between pb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <span className="text-base font-semibold">When can I retire?</span>
          </div>
          {monthsDelta !== null && (
            <Badge
              className={
                monthsDelta > 0
                  ? "bg-emerald-500/15 text-emerald-500 border-0"
                  : "bg-destructive/15 text-destructive border-0"
              }
            >
              {monthsDelta > 0
                ? `▲ ${monthsDelta} month${monthsDelta === 1 ? "" : "s"} sooner`
                : `▼ ${Math.abs(monthsDelta)} month${Math.abs(monthsDelta) === 1 ? "" : "s"} later`}
            </Badge>
          )}
        </div>

        {/* Age + sparkline */}
        <div className="flex items-center gap-4 pb-3">
          <div className="flex items-end gap-1 shrink-0">
            {projectedAge !== null ? (
              <>
                <span className="text-5xl font-bold text-primary leading-none">
                  {projectedAge}
                </span>
                <span className="text-sm text-muted-foreground pb-1">yrs old</span>
              </>
            ) : (
              <span className="text-2xl font-semibold text-muted-foreground">—</span>
            )}
          </div>
          {projection.fireProjectionByAge.length > 1 && (
            <div className="flex-1 h-10 text-primary opacity-70">
              <Sparkline data={projection.fireProjectionByAge} />
            </div>
          )}
        </div>

        {/* Suggestion text */}
        {suggestionContent && (
          <p className="text-sm text-muted-foreground pb-4 border-b border-border">
            {suggestionContent}
          </p>
        )}

        {/* Per–account-type rows */}
        <div className="flex flex-col pt-1">
          {accountTypeRows.map((row) => {
            const currentValue = row.baselineMonthly + (offsets.get(row.accountType) ?? 0);
            return (
              <AccountTypeRow
                key={row.accountType}
                row={row}
                currentValue={currentValue}
                onChangeValue={(v) => onChangeOffset(row.accountType, v - row.baselineMonthly)}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Total monthly</span>
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-primary tabular-nums">
              {formatGBP(total)}/mo
            </span>
            {hasAnyOffset && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => {
                  onReset();
                  setResetDialogOpen(false);
                }}
              >
                <RefreshCw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
