import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { PosNegNumber } from "../common/PosNegNumber";
import { Button } from "../ui/button";
import { ChartBar, ChartLine } from "lucide-react";
import { cn } from "@/lib/utils";

type FireOverviewPrimaryCardProps = {
  targetRetirementAge: number | null;
  valueAtRetirement: number | null;
  fireNumber: number | null;
  showChart: boolean;
  onToggleChart: () => void;
};

function FireOverviewPrimaryCard({
  targetRetirementAge,
  valueAtRetirement,
  fireNumber,
  showChart,
  onToggleChart,
}: FireOverviewPrimaryCardProps) {
  const difference = useMemo(
    () =>
      valueAtRetirement && fireNumber ? valueAtRetirement - fireNumber : null,
    [fireNumber, valueAtRetirement]
  );

  return (
    <Card className="flex flex-col gap-2 w-full">
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Portfolio Projection
        </CardTitle>
        <CardContent>
          {valueAtRetirement && targetRetirementAge && difference !== null ? (
            <>
              <div className="flex items-start justify-start gap-10">
                <div className="flex flex-col gap-2 flex-1">
                  <span className="text-4xl font-bold block">
                    {Intl.NumberFormat("en-GB", {
                      style: "currency",
                      currency: "GBP",
                    }).format(valueAtRetirement)}
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-medium text-muted-foreground block">
                      {targetRetirementAge
                        ? `By age: ${targetRetirementAge}`
                        : "—"}
                    </span>
                    <span className="text-medium text-muted-foreground block">
                      <PosNegNumber value={difference} />
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-0">
                  {/* TODO: The icon should fill the button */}
                  <Button
                    variant="ghost"
                    size="lg"
                    className={cn(
                      "cursor-pointer border rounded-full w-20 h-20 p-5 m-0 flex items-center justify-center [&_svg]:!w-full [&_svg]:!h-full",
                      showChart ? "bg-gray-100" : "bg-transparent"
                    )}
                    onClick={onToggleChart}
                  >
                    <ChartLine strokeWidth={1} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="text-medium font-bold block">
                Not enough data to calculate
              </span>
            </>
          )}
        </CardContent>
      </CardHeader>
    </Card>
  );
}

type FireOverviewCurrentPortfolioCardProps = {
  currentPortfolioValue: number | null;
  currentPortfolioValueGrowth: number | null;
};

function FireOverviewCurrentPortfolioCard({
  currentPortfolioValue,
  currentPortfolioValueGrowth,
}: FireOverviewCurrentPortfolioCardProps) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-base font-medium">Total Portfolio</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-start gap-10">
          <div className="flex flex-col gap-2 flex-1">
            <span className="text-4xl font-bold block">
              {currentPortfolioValue !== null
                ? Intl.NumberFormat("en-GB", {
                    style: "currency",
                    currency: "GBP",
                  }).format(currentPortfolioValue)
                : "—"}
            </span>
            <span className="text-medium block">
              {currentPortfolioValueGrowth !== null
                ? PosNegNumber({ value: currentPortfolioValueGrowth })
                : "—"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FireOverviewFireNumberCardProps = {
  fireNumber: number | null;
};

function FireOverviewFireNumberCard({
  fireNumber,
}: FireOverviewFireNumberCardProps) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-base font-medium">FIRE Number</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-start gap-10">
          <div className="flex flex-col gap-2 flex-1">
            <span className="text-4xl font-bold block">
              {fireNumber !== null
                ? Intl.NumberFormat("en-GB", {
                    style: "currency",
                    currency: "GBP",
                  }).format(fireNumber)
                : "—"}
            </span>
            <span className="text-medium block">NI + 75 (What is this?)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FireOverviewProgressCardProps = {
  progressPercentage: number | null;
};

function FireOverviewProgressCard({
  progressPercentage,
}: FireOverviewProgressCardProps) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-base font-medium">Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-start gap-10">
          <div className="flex flex-col gap-2 flex-1">
            <span className="text-4xl font-bold block">
              {progressPercentage !== null ? `${progressPercentage}%` : "—"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FireOverviewCurrentAgeCardProps = {
  currentAge: number | null;
};

function FireOverviewCurrentAgeCard({
  currentAge,
}: FireOverviewCurrentAgeCardProps) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-base font-medium">Current Age</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-start gap-10">
          <div className="flex flex-col gap-2 flex-1">
            <span className="text-4xl font-bold block">
              {currentAge !== null ? `${currentAge}` : "—"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FireOverviewYearsToFireCardProps = {
  yearsToFire: number | null;
};

function FireOverviewYearsToFireCard({
  yearsToFire,
}: FireOverviewYearsToFireCardProps) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-base font-medium">Years to FIRE</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-start gap-10">
          <div className="flex flex-col gap-2 flex-1">
            <span className="text-4xl font-bold block">
              {yearsToFire !== null ? `${yearsToFire}` : "—"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FireOverviewCardProps = {
  targetRetirementAge: number | null;
  valueAtRetirement: number | null;
  fireNumber: number | null;
  showChart: boolean;
  onToggleChart: () => void;
  currentPortfolioValue: number | null;
  currentPortfolioValueGrowth: number | null;
  progressPercentage: number | null;
  currentAge: number | null;
  yearsToFire: number | null;
};

export function FireOverviewCard({
  targetRetirementAge,
  valueAtRetirement,
  fireNumber,
  showChart,
  onToggleChart,
  currentPortfolioValue,
  currentPortfolioValueGrowth,
  progressPercentage,
  currentAge,
  yearsToFire,
}: FireOverviewCardProps) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <FireOverviewPrimaryCard
          targetRetirementAge={targetRetirementAge}
          valueAtRetirement={valueAtRetirement}
          fireNumber={fireNumber}
          showChart={showChart}
          onToggleChart={onToggleChart}
        />
        <div className="flex flex-row gap-2">
          <FireOverviewCurrentPortfolioCard
            currentPortfolioValue={currentPortfolioValue}
            currentPortfolioValueGrowth={currentPortfolioValueGrowth}
          />
          <FireOverviewFireNumberCard fireNumber={fireNumber} />
        </div>
        <div className="flex flex-row gap-2">
          <FireOverviewProgressCard progressPercentage={progressPercentage} />
          <FireOverviewCurrentAgeCard currentAge={currentAge} />
          <FireOverviewYearsToFireCard yearsToFire={yearsToFire} />
        </div>
      </div>
    </>
  );
}
