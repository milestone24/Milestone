import { useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Trash2 } from "lucide-react";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
import {
  AccountType,
  accountType,
  ContributionTypes,
  contributionTypes,
  createDecimalValueString,
  DecimalValueString,
  MonthlyContributionDifference,
} from "@shared/schema";
import type { Contributor } from "@shared/schema/projections";
import { Label } from "../ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "../ui/select";
import { Slider } from "../ui/slider";
import { ContributionPreviewState } from "@/hooks/use-fire-preview-state";
import { PosNegNumber } from "../common/PosNegNumber";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "../ui/dialog";
import type { FireContributor } from "@/hooks/use-fire";
import {
  contributionModifierPresets,
  contributorFromPreset,
  montlyScheduleWithValue,
  presets,
  singleMonthlyContributorAmount,
} from "@shared/utils/contributor";

type DraftContributor = {
  name: string;
  accountType: AccountType;
  type: ContributionTypes;
  monthlyAmount: number;
};

const accountTypeOptions = accountType as readonly AccountType[];
const contributionTypeOptions =
  contributionTypes as readonly ContributionTypes[];

function ContributionsBreakDownDisplay({
  contributionBreakdown,
}: {
  contributionBreakdown: Array<{ accountType: string; amount: number }>;
}) {
  const contributionsCount = useMemo(() => {
    return contributionBreakdown.length;
  }, [contributionBreakdown]);

  return (
    <>
      {contributionsCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          No contributor data available. Add assets or custom preview
          contributors to see the breakdown.
        </p>
      ) : (
        <ul className="space-y-2">
          {contributionBreakdown.map((item) => (
            <li
              key={item.accountType}
              className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
            >
              <span className="font-medium text-foreground">
                {item.accountType}
              </span>
              <span className="font-semibold text-foreground">
                £{item.amount.toLocaleString()}/mo
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

type FireContributionsCardProps = {
  contributors: FireContributor[];
  contributionBreakdown: Array<{ accountType: string; amount: number }>;
  monthlyContributionDifference: MonthlyContributionDifference | null;
  contributionPreviewState: ContributionPreviewState;
  onChangeContributionPreviewState: (state: ContributionPreviewState) => void;
  onResetContributionPreviewState: () => void;
  customStartingValue: number;
  onCustomStartingValueChange: (value: number) => void;

  onAddContributor: (input: Omit<FireContributor, "id">) => void;
  onUpdateContributor: (
    id: string,
    updates: Partial<Omit<FireContributor, "id">>,
  ) => void;
  onRemoveContributor: (id: string) => void;
  onResetContributors: () => void;
  totalMonthlyAmount: DecimalValueString;
};

export function FireContributionsCard(props: FireContributionsCardProps) {
  const {
    contributors,
    contributionBreakdown,
    monthlyContributionDifference,
    onAddContributor,
    onUpdateContributor,
    onRemoveContributor,
    onResetContributors,
    contributionPreviewState,
    onChangeContributionPreviewState,
  } = props;

  const contributionsCount = useMemo(() => {
    return contributionBreakdown.length;
  }, [contributionBreakdown]);

  const contributionsCountLabel = useMemo(() => {
    return contributionsCount > 0
      ? `${contributionsCount} contribution${
          contributionsCount === 1 ? "" : "s"
        }`
      : "0";
  }, [contributionsCount]);

  const contributionPercentage = Math.round(
    contributionPreviewState.scaleFactor * 100,
  );

  const [draft, setDraft] = useState<DraftContributor>({
    name: "Custom Contribution",
    accountType: (accountTypeOptions[0] ?? "ISA") as AccountType,
    type: "asset",
    monthlyAmount: 100,
  });

  const [addDialogOpen, setAddDialogOpen] = useState(false);

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
    <Card className="flex flex-col gap-2 w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium">
            Fire Contributions
          </CardTitle>
          <Badge variant="secondary">{contributionsCountLabel}</Badge>
        </div>
        <span className="text-sm text-muted-foreground block">
          Approximate monthly contribution:
          {approximateMonthlyContributionNumber}
        </span>
        {monthlyContributionDifferenceNumber !== null ? (
          monthlyContributionDifferenceNumber < 0 ? (
            <div className="text-sm text-muted-foreground">
              <span>
                It is estimated that you are under contributing per month
                by{" "}
              </span>
              <PosNegNumber
                value={Number(monthlyContributionDifferenceNumber)}
              />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <span>
                It is estimated that you are over contributing per month by{" "}
              </span>
              <PosNegNumber
                value={Number(monthlyContributionDifferenceNumber)}
              />
            </div>
          )
        ) : null}
        <span className="text-sm text-muted-foreground block">
          * This is an estimate. Different investment types will have different
          effects on the projected total value of your portfolio.
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <ContributionsBreakDownDisplay
          contributionBreakdown={contributionBreakdown}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-foreground">
              Adjustment Contributor
            </h3>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">Add adjustment contributor</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add adjustment contributor</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Add a synthetic contributor to test how different accounts and
                  amounts change your FIRE outlook. Changes are preview-only and
                  will not affect your actual portfolio.
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
                    <Label htmlFor="preview-contributor-account">
                      Account type
                    </Label>
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
          </div>
          {contributors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No contributor data available. Include portfolio contributions or
              add preview contributors to see the breakdown.
            </p>
          ) : (
            <ul className="space-y-2">
              {/* TODO: make cards */}
              {contributors.map((entry) => {
                //const c = entry.contributor;
                const monthly = singleMonthlyContributorAmount(entry);
                const sourceLabel =
                  entry.type === "asset"
                    ? "Portfolio"
                    : entry.type === "custom"
                      ? "Other"
                      : "Preview";
                const isPreview = entry.type === "custom";
                const isPortfolio = entry.type === "asset";
                return (
                  <li
                    key={entry.id}
                    className={`flex flex-col gap-2 rounded-lg border p-3 text-sm md:flex-row md:items-center md:justify-between ${
                      isPreview
                        ? "bg-primary/5 border-primary/20"
                        : "bg-background"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          entry.type === "asset" ? "secondary" : "outline"
                        }
                        className="shrink-0"
                      >
                        {sourceLabel}
                      </Badge>
                      <div>
                        <p className="font-medium text-foreground">
                          {entry.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.accountType ?? "—"} •{" "}
                          {entry.type.replace("_", " ")} • £
                          {monthly.toLocaleString()}/mo
                        </p>
                      </div>
                    </div>
                    {isPreview ? (
                      <div className="flex items-center gap-2">
                        <Input
                          className="w-24 h-8 text-sm"
                          type="number"
                          min={0}
                          value={entry.schedules[0]?.value ?? 0}
                          onChange={(e) =>
                            onUpdateContributor(entry.id, {
                              schedules: [
                                montlyScheduleWithValue(
                                  Number(e.target.value ?? 0),
                                ),
                              ],
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveContributor(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : isPortfolio ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={
                          () => undefined
                          //TODO
                          //togglePortfolioExcluded(entry.referenceId)
                        }
                      >
                        Exclude
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {contributors.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onResetContributors}>
            Reset preview contributors
          </Button>
        )}

        <Separator />

        <section className="space-y-3">
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
        </section>
      </CardContent>
    </Card>
  );
}
