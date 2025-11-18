import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";
import {
  ContributionMode,
  StandaloneContributor,
} from "@/hooks/use-standalone-contributors";
import { accountType } from "@shared/schema";
import type { AccountType } from "@shared/schema";
import { contributionTypes } from "@shared/schema/projections";
import type { ContributionTypes } from "@shared/schema/projections";

export type StandaloneContributorsPanelProps = {
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

type DraftContributor = {
  name: string;
  accountType: AccountType;
  type: StandaloneContributor["type"];
  monthlyAmount: number;
};

const accountTypeOptions = accountType as readonly AccountType[];
const contributionTypeOptions = contributionTypes as readonly ContributionTypes[];

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
    accountType: "CISA",
    type: "workplace_pension",
    monthlyAmount: 250,
  },
];

export function StandaloneContributorsPanel({
  mode,
  onModeChange,
  contributors,
  onAddContributor,
  onUpdateContributor,
  onRemoveContributor,
  onReset,
  totalMonthlyAmount,
}: StandaloneContributorsPanelProps) {
  const [draft, setDraft] = useState<DraftContributor>({
    name: "Custom Contribution",
    accountType: (accountTypeOptions[0] ?? "ISA") as AccountType,
    type: "asset",
    monthlyAmount: 100,
  });

  const isCustomMode = mode === "custom";

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base font-medium">
              Contribution Source
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Switch between your live portfolio contributions and a custom
              what-if scenario.
            </p>
          </div>
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
              Custom scenario
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isCustomMode ? "default" : "secondary"}>
            {isCustomMode ? "Preview active" : "Live data"}
          </Badge>
          <span className="text-xs text-muted-foreground">{totalDisplay}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCustomMode ? (
          <>
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm text-muted-foreground">
              Configure synthetic contributors to test how different accounts and
              amounts change your FIRE outlook. These changes are <span className="font-medium text-primary">preview-only</span> and do not
              modify your saved settings.
            </div>

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
                  <Label htmlFor="preview-contributor-type">Contribution type</Label>
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
                    !draft.name.trim() || !Number.isFinite(draft.monthlyAmount) || draft.monthlyAmount <= 0
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
                    ? `${contributors.length} source${contributors.length === 1 ? "" : "s"}`
                    : "None added"}
                </Badge>
              </div>
              {contributors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contributors added yet. Use the form above or choose a preset to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {contributors.map((contributor) => (
                    <div
                      key={contributor.id}
                      className="flex flex-col gap-3 rounded-lg border bg-background p-3 text-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium text-foreground">{contributor.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {contributor.accountType} • {contributor.type.replace("_", " ")}
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
                                monthlyAmount: Number(event.target.value ?? 0),
                              })
                            }
                          />
                          <span className="text-muted-foreground">/mo</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveContributor(contributor.id)}
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
        ) : (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            Your projection uses the recurring contributions saved against your portfolio assets.
            Switch to <span className="font-medium text-foreground">Custom scenario</span> to explore
            what-if contributions without updating your live settings.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

