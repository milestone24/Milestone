import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  contributionTypes,
  ContributionTypes,
  Contributor,
  MonthlyContributionDifference,
  WithdrawalStrategy,
} from "@shared/schema/projections";
import { AccountAccessTimeline } from "./AccountAccessTimeline";
import { AccountAccessCard } from "./AccountAccessCard";
import { WithdrawalPhaseCard } from "./WithdrawalPhaseCard";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { PosNegNumber } from "../common/PosNegNumber";
import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  accountType,
  AccountType,
  createDecimalValueString,
} from "@shared/schema";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SelectContent } from "@radix-ui/react-select";
import {
  contributionModifierPresets,
  contributorFromPreset,
  montlyScheduleWithValue,
  presets,
} from "@shared/utils/contributor";
import { Slider } from "../ui/slider";
import { ContributionPreviewState } from "@/hooks/use-fire-preview-state";

type DraftContributor = {
  name: string;
  accountType: AccountType;
  type: ContributionTypes;
  monthlyAmount: number;
};

const accountTypeOptions = accountType as readonly AccountType[];
const contributionTypeOptions =
  contributionTypes as readonly ContributionTypes[];

type ContrinutionsInfoProps = {
  contributionBreakdown: Array<{ accountType: string; amount: number }>;
  monthlyContributionDifference: MonthlyContributionDifference | null;
};

const ContrinutionsInfo = ({
  contributionBreakdown,
  monthlyContributionDifference,
}: ContrinutionsInfoProps) => {
  const contributionsCount = useMemo(() => {
    return contributionBreakdown.length;
  }, [contributionBreakdown]);

  const contributionsCountLabel = useMemo(() => {
    return contributionsCount > 0
      ? `${contributionsCount} contributor${
          contributionsCount === 1 ? "" : "s"
        }`
      : "0";
  }, [contributionsCount]);

  const monthlyContributionDifferenceNumber = useMemo(() => {
    return monthlyContributionDifference
      ? Number(monthlyContributionDifference.monthlyContributionDifference)
      : null;
  }, [monthlyContributionDifference]);

  const approximateMonthlyContributionNumber = useMemo(() => {
    return monthlyContributionDifference
      ? Number(monthlyContributionDifference.approximateMonthlyContribution)
      : null;
  }, [monthlyContributionDifference]);

  return (
    <>
      <span className="text-sm text-muted-foreground block">
        Approximate monthly contribution:
        {approximateMonthlyContributionNumber}
      </span>
      {monthlyContributionDifferenceNumber !== null ? (
        monthlyContributionDifferenceNumber < 0 ? (
          <div className="text-sm text-muted-foreground">
            <span>
              It is estimated that you are under contributing per month by{" "}
            </span>
            <PosNegNumber value={Number(monthlyContributionDifferenceNumber)} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            <span>
              It is estimated that you are over contributing per month by{" "}
            </span>
            <PosNegNumber value={Number(monthlyContributionDifferenceNumber)} />
          </div>
        )
      ) : null}
      <span className="text-sm text-muted-foreground block">
        * This is an estimate. Different investment types will have different
        effects on the projected total value of your portfolio.
      </span>
    </>
  );
};

type AdjustmentContributorProps = {
  onAddContributor: (input: Omit<Contributor, "id">) => void;
  onResetContributors?: () => void;
};

const AdjustmentContributor = ({
  onAddContributor,
  onResetContributors,
}: AdjustmentContributorProps) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const [draft, setDraft] = useState<DraftContributor>({
    name: "Custom Contribution",
    accountType: (accountTypeOptions[0] ?? "ISA") as AccountType,
    type: "adjustment",
    monthlyAmount: 100,
  });

  const handleAddFromDialog = () => {
    if (!draft.name.trim() || draft.monthlyAmount <= 0) return;
    onAddContributor({
      name: draft.name.trim(),
      accountType: draft.accountType,
      type: draft.type,
      schedules: [montlyScheduleWithValue(draft.monthlyAmount)],
      includeContributions: true,
      includeValue: true,
      currentValue: createDecimalValueString("0"),
    });
    setDraft((prev) => ({
      ...prev,
      name: "Custom Contribution",
    }));
    setAddDialogOpen(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 space-y-2">
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            Add adjustment contributor
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add adjustment contributor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Add a synthetic contributor to test how different accounts and
            amounts change your FIRE outlook. Changes are preview-only and will
            not affect your actual portfolio.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="preview-contributor-name">Label</Label>
              <Input
                id="preview-contributor-name"
                value={draft.name}
                placeholder="e.g. Custom LISA"
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preview-contributor-account">Account type</Label>
              <Select
                value={draft.accountType}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    accountType: value as AccountType,
                  }))
                }
              >
                <SelectTrigger id="preview-contributor-account">
                  <SelectValue placeholder="Account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {accountTypeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preview-contributor-type">
                Contribution type
              </Label>
              <Select
                value={draft.type}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    type: value as ContributionTypes,
                  }))
                }
              >
                <SelectTrigger id="preview-contributor-type">
                  <SelectValue placeholder="Contribution type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {contributionTypeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preview-contributor-amount">
                Monthly amount (£)
              </Label>
              <Input
                id="preview-contributor-amount"
                type="number"
                min={0}
                value={draft.monthlyAmount}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    monthlyAmount: Number(event.target.value ?? 0),
                  }))
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {presets.map((preset) => (
              <Button
                key={`${preset.accountType}-${preset.monthlyAmount}`}
                variant="outline"
                size="sm"
                onClick={() => {
                  onAddContributor(contributorFromPreset(preset));
                  setAddDialogOpen(false);
                }}
              >
                {preset.name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddFromDialog}
              disabled={
                !draft.name.trim() ||
                !Number.isFinite(draft.monthlyAmount) ||
                draft.monthlyAmount <= 0
              }
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!!onResetContributors ? (
        <Button variant="ghost" size="sm" onClick={onResetContributors}>
          Remove all adjustment contributors
        </Button>
      ) : null}
    </div>
  );
};

type ContrinutionMultiplierProps = {
  contributionPercentage: number;
  onChangeContributionPreviewState: (state: ContributionPreviewState) => void;
  contributionPreviewState: ContributionPreviewState;
};

const ContrinutionMultiplier = ({
  contributionPercentage,
  onChangeContributionPreviewState,
  contributionPreviewState,
}: ContrinutionMultiplierProps) => {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Contribution multiplier
          </h3>
          <p className="text-xs text-muted-foreground">
            Scale your monthly contributions for preview purposes.
          </p>
        </div>
        <Badge variant="secondary">{contributionPercentage}%</Badge>
      </div>

      <Slider
        value={[contributionPreviewState.scaleFactor]}
        min={0}
        max={3}
        step={0.05}
        onValueChange={([scale]) => {
          if (typeof scale !== "number") return;
          onChangeContributionPreviewState({
            ...contributionPreviewState,
            scaleFactor: Number(scale.toFixed(2)),
          });
        }}
      />

      <div className="flex flex-wrap gap-2">
        {contributionModifierPresets.map((preset) => (
          <Button
            key={preset.label}
            variant={
              contributionPreviewState.scaleFactor === preset.scale
                ? "default"
                : "outline"
            }
            size="sm"
            onClick={() =>
              onChangeContributionPreviewState({
                ...contributionPreviewState,
                scaleFactor: preset.scale,
              })
            }
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </>
  );
};

type WithdrawalStrategyCardProps = {
  withdrawalStrategy: WithdrawalStrategy | undefined;
  contributionsInfo: ContrinutionsInfoProps;

  contributionPreviewState: ContributionPreviewState;
  onAddContributor: (input: Omit<Contributor, "id">) => void;
  onUpdateContributor: (
    id: string,
    updates: Partial<Omit<Contributor, "id">>,
  ) => void;
  onRemoveContributor: (id: string) => void;
  onResetContributors: () => void;
  onChangeContributionPreviewState: (state: ContributionPreviewState) => void;
  onResetContributionPreviewState: () => void;
};

export function WithdrawalStrategyCard({
  withdrawalStrategy,
  contributionsInfo,
  contributionPreviewState,
  onAddContributor,
  onUpdateContributor,
  onRemoveContributor,
  onResetContributors,
  onChangeContributionPreviewState,
  onResetContributionPreviewState,
}: WithdrawalStrategyCardProps) {
  const {
    phases = [],
    accountAccessTimeline = [],
    warnings = [],
  } = withdrawalStrategy ?? {};

  const contributionPercentage = Math.round(
    contributionPreviewState.scaleFactor * 100,
  );

  const adjustmentContrinutorsLength = useMemo(() => {
    return accountAccessTimeline.filter((c) => c.type === "adjustment").length;
  }, [accountAccessTimeline]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Calendar className="h-5 w-5" />
          Contributors, Access & Withdrawal Strategy
        </CardTitle>
        <ContrinutionsInfo {...contributionsInfo} />
        <p className="text-sm text-muted-foreground">
          When accounts unlock and how you'll draw from them
        </p>
      </CardHeader>
      {!withdrawalStrategy ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Withdrawal strategy is not available. Please ensure you have
            contributors configured.
          </p>
        </CardContent>
      ) : (
        <>
          <CardContent className="space-y-6">
            {/* Account Access Timeline */}
            <section>
              <AccountAccessTimeline entries={accountAccessTimeline} />
            </section>

            <Separator />

            {/* Account Access Cards */}
            <section className="space-y-3">
              {accountAccessTimeline.map((entry, index) => (
                <AccountAccessCard
                  key={`${entry.contributorName}-${index}`}
                  entry={entry}
                  onUpdateContributor={onUpdateContributor}
                  onRemoveContributor={onRemoveContributor}
                />
              ))}
              <AdjustmentContributor
                onAddContributor={onAddContributor}
                onResetContributors={
                  adjustmentContrinutorsLength > 0
                    ? onResetContributors
                    : undefined
                }
              />
              <ContrinutionMultiplier
                contributionPercentage={contributionPercentage}
                onChangeContributionPreviewState={
                  onChangeContributionPreviewState
                }
                contributionPreviewState={contributionPreviewState}
              />
            </section>

            <Separator />

            {/* Withdrawal Strategy Phases */}
            <section>
              <h3 className="mb-4 text-sm font-medium">Withdrawal Strategy</h3>
              <div className="space-y-6">
                {phases.map((phase, index) => (
                  <WithdrawalPhaseCard
                    key={`phase-${phase.fromAge}-${index}`}
                    phase={phase}
                  />
                ))}
              </div>
            </section>

            {/* Warnings */}
            {warnings && warnings.length > 0 && (
              <>
                <Separator />
                <section className="space-y-2">
                  <h3 className="text-sm font-medium text-amber-600">
                    Warnings
                  </h3>
                  {warnings.map((warning, index) => (
                    <p key={index} className="text-sm text-muted-foreground">
                      {warning}
                    </p>
                  ))}
                </section>
              </>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
}
