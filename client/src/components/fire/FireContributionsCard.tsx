import { useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
// import {
//   StandaloneContributorsPanel,
// } from "./StandaloneContributorsPanel";
import {
  ContributionMode,
  StandaloneContributor,
} from "@/hooks/use-standalone-contributors";
import { Button } from "../ui/button";
import { Trash2 } from "lucide-react";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
import {
  AccountType,
  accountType,
  ContributionTypes,
  contributionTypes,
  DecimalValueString,
  MonthlyContributionDifference,
} from "@shared/schema";
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
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

type DraftContributor = {
  name: string;
  accountType: AccountType;
  type: StandaloneContributor["type"];
  monthlyAmount: number;
};

const accountTypeOptions = accountType as readonly AccountType[];
const contributionTypeOptions =
  contributionTypes as readonly ContributionTypes[];

const presets: Array<Omit<StandaloneContributor, "id">> = [
  {
    name: "LISA £100/mo",
    accountType: "LISA",
    type: "asset",
    monthlyAmount: 100,
  },
  {
    name: "SIPP £200/mo",
    accountType: "SIPP",
    type: "asset",
    monthlyAmount: 200,
  },
  {
    name: "ISA £150/mo",
    accountType: "ISA",
    type: "asset",
    monthlyAmount: 150,
  },
  {
    name: "Workplace Pension £250/mo",
    //TODO a workplace pension should not have to be a CISA
    accountType: "CISA",
    type: "workplace_pension",
    monthlyAmount: 250,
  },
];

const contributionPresets: Array<{ label: string; scale: number }> = [
  { label: "50%", scale: 0.5 },
  { label: "75%", scale: 0.75 },
  { label: "100%", scale: 1 },
  { label: "150%", scale: 1.5 },
  { label: "200%", scale: 2 },
];

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

type StandaloneContributorsPanelProps = {
  mode: ContributionMode;
  onModeChange: (mode: ContributionMode) => void;
  contributors: StandaloneContributor[];
  onAddContributor: (input: Omit<StandaloneContributor, "id">) => void;
  onUpdateContributor: (
    id: string,
    updates: Partial<Omit<StandaloneContributor, "id">>
  ) => void;
  onRemoveContributor: (id: string) => void;
  onReset: () => void;
  totalMonthlyAmount: number;
};

type FireContributionsCardProps = StandaloneContributorsPanelProps & {
  contributionBreakdown: Array<{ accountType: string; amount: number }>;
  monthlyContributionDifference: MonthlyContributionDifference | null;
  contributionPreviewState: ContributionPreviewState;
  onChangeContributionPreviewState: (state: ContributionPreviewState) => void;
  onResetContributionPreviewState: () => void;
  customStartingValue: number;
  onCustomStartingValueChange: (value: number) => void;
};

export function FireContributionsCard({
  contributionBreakdown,
  monthlyContributionDifference,
  mode,
  onModeChange,
  contributors,
  onAddContributor,
  onUpdateContributor,
  onRemoveContributor,
  onReset,
  totalMonthlyAmount,
  contributionPreviewState,
  onChangeContributionPreviewState,
  customStartingValue,
  onCustomStartingValueChange,
}: FireContributionsCardProps) {
  console.log(
    "Contributions Card contributionBreakdown",
    contributionBreakdown
  );

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
    contributionPreviewState.scaleFactor * 100
  );

  const [draft, setDraft] = useState<DraftContributor>({
    name: "Custom Contribution",
    accountType: (accountTypeOptions[0] ?? "ISA") as AccountType,
    type: "asset",
    monthlyAmount: 100,
  });

  const isCustomMode = mode === "custom";
  const isSettingsMode = mode === "settings";
  const isPortfolioMode = mode === "portfolio";

  const handleAdd = () => {
    if (!draft.name.trim() || draft.monthlyAmount <= 0) return;
    onAddContributor({
      name: draft.name.trim(),
      accountType: draft.accountType,
      type: draft.type,
      monthlyAmount: draft.monthlyAmount,
    });
    setDraft((prev) => ({
      ...prev,
      name: "Custom Contribution",
    }));
  };

  const totalDisplay = useMemo(() => {
    if (!isCustomMode) {
      return "Using portfolio contributions";
    }
    return totalMonthlyAmount > 0
      ? `Previewing £${totalMonthlyAmount.toLocaleString()}/mo`
      : "No preview contributors configured";
  }, [isCustomMode, totalMonthlyAmount]);

  const contributionPresets: Array<{ label: string; scale: number }> = [
    { label: "50%", scale: 0.5 },
    { label: "75%", scale: 0.75 },
    { label: "100%", scale: 1 },
    { label: "150%", scale: 1.5 },
    { label: "200%", scale: 2 },
  ];

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

  const [customValueType, setCustomValueType] = useState<
    "custom" | "portfolio"
  >("portfolio");

  return (
    <>
      <Card className="flex flex-col gap-2 w-full">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-medium">
              Fire Contributions
            </CardTitle>
            <Badge variant="secondary">{contributionsCountLabel}</Badge>
          </div>
          {/* <p className="text-sm text-muted-foreground">
            Monthly contribution preview grouped by account type (including
            custom scenarios).
          </p> */}
          <div className="flex gap-2 rounded-md bg-muted p-1">
            <Button
              variant={mode === "portfolio" ? "default" : "ghost"}
              size="sm"
              onClick={() => onModeChange("portfolio")}
            >
              Use portfolio
            </Button>
            <Button
              variant={mode === "custom" ? "default" : "ghost"}
              size="sm"
              onClick={() => onModeChange("custom")}
            >
              Use Custom scenario
            </Button>
            <Button
              variant={mode === "settings" ? "default" : "ghost"}
              size="sm"
              onClick={() => onModeChange("settings")}
            >
              Use FIRE Setting
            </Button>
          </div>
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
            * This is an estimate. Different investment types will have
            different effects on the projected total value of your portfolio.
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <>
            {isCustomMode ? (
              <>
                <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm text-muted-foreground">
                  Configure synthetic contributors to test how different
                  accounts and amounts change your FIRE outlook. These changes
                  are{" "}
                  <span className="font-medium text-primary">preview-only</span>{" "}
                  and do not modify your saved settings.
                </div>

                <div>
                  <p>
                    What initial value do you want to use for the custom
                    scenario?
                  </p>
                  <Label htmlFor="custom-value-type">Custom value type</Label>
                  <RadioGroup
                    value={customValueType}
                    onValueChange={(value) =>
                      setCustomValueType(value as "custom" | "portfolio")
                    }
                    className="flex flex-row gap-2"
                  >
                    <div className="flex flex-row gap-2 items-start">
                      <div className="flex flex-col gap-2 pt-2">
                        <RadioGroupItem
                          value="portfolio"
                          id="portfolio"
                          className="flex-shrink-0"
                        />
                      </div>
                      <div className="flex flex-col pt-1">
                        <label htmlFor="portfolio">Portfolio</label>
                      </div>
                    </div>
                    <div className="flex flex-row gap-2 items-start">
                      <div className="flex flex-col gap-2 pt-2">
                        <RadioGroupItem
                          value="custom"
                          id="custom"
                          className="flex-shrink-0"
                        />
                      </div>
                      <div className="flex flex-col pt-1">
                        <label htmlFor="custom">Custom</label>
                      </div>
                    </div>
                  </RadioGroup>
                  {customValueType === "portfolio" ? (
                    <p>
                      The initial value will be the current value of your
                      portfolio.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-value">Custom value</Label>
                      <Input
                        id="custom-value"
                        type="number"
                        value={customStartingValue.toString()}
                        onChange={(event) =>
                          onCustomStartingValueChange(
                            Number(event.target.value ?? "")
                          )
                        }
                      />
                    </div>
                  )}
                </div>

                <ContributionsBreakDownDisplay
                  contributionBreakdown={contributionBreakdown}
                />

                <div className="space-y-3 rounded-lg border bg-background p-3">
                  <h3 className="text-sm font-medium text-foreground">
                    Add preview contributor
                  </h3>

                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleAdd}
                      disabled={
                        !draft.name.trim() ||
                        !Number.isFinite(draft.monthlyAmount) ||
                        draft.monthlyAmount <= 0
                      }
                    >
                      Add preview contributor
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onReset}
                      disabled={contributors.length === 0}
                    >
                      Reset preview
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {presets.map((preset) => (
                      <Button
                        key={`${preset.accountType}-${preset.monthlyAmount}`}
                        variant="outline"
                        size="sm"
                        onClick={() => onAddContributor(preset)}
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">
                      Preview contributors
                    </h3>
                    <Badge variant="secondary">
                      {contributors.length > 0
                        ? `${contributors.length} source${
                            contributors.length === 1 ? "" : "s"
                          }`
                        : "None added"}
                    </Badge>
                  </div>
                  {contributors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No contributors added yet. Use the form above or choose a
                      preset to get started.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {contributors.map((contributor) => (
                        <div
                          key={contributor.id}
                          className="flex flex-col gap-3 rounded-lg border bg-background p-3 text-sm md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {contributor.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {contributor.accountType} •{" "}
                              {contributor.type.replace("_", " ")}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-sm">
                              <span className="text-muted-foreground">£</span>
                              <Input
                                className="w-28"
                                type="number"
                                min={0}
                                value={contributor.monthlyAmount}
                                onChange={(event) =>
                                  onUpdateContributor(contributor.id, {
                                    monthlyAmount: Number(
                                      event.target.value ?? 0
                                    ),
                                  })
                                }
                              />
                              <span className="text-muted-foreground">/mo</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                onRemoveContributor(contributor.id)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
            {isPortfolioMode ? (
              <>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Your projection uses the recurring contributions saved against
                  your portfolio assets. Switch to{" "}
                  <span className="font-medium text-foreground">
                    Custom scenario
                  </span>{" "}
                  to explore what-if contributions without updating your live
                  settings.
                </div>
                <ContributionsBreakDownDisplay
                  contributionBreakdown={contributionBreakdown}
                />
                <span className="text-sm text-muted-foreground block">
                  TODO: Allow adding preview contributors to the portfolio
                </span>
              </>
            ) : null}
            {isSettingsMode ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                Your projection uses the FIRE settings saved. Switch to{" "}
                <span className="font-medium text-foreground">
                  Custom scenario
                </span>{" "}
                to explore what-if contributions without updating your live
                settings.
              </div>
            ) : null}
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
                {contributionPresets.map((preset) => (
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
          </>
        </CardContent>
      </Card>
    </>
  );
}
