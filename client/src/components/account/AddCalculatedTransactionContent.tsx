import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coins, Layers2 } from "lucide-react";
import { TransactionSingleForm } from "./TransactionSingleForm";
import { AssetSecurityTransactionSingleForm } from "./AssetSecurityTransactionSingleForm";
import { useAssetContributionCreate } from "@/hooks/use-asset-contribution-create";
import { useSecurityTransactions } from "@/hooks/use-security-transactions";
import type {
  AssetContributionFormData,
  AssetTransactionSource,
  SecurityTransactionInsert,
  UserAssetSecuritySelect,
} from "@shared/schema";
import { createDecimalValueString } from "@shared/schema";

type TxKind = "cash" | "investment";
type Direction = "purchase" | "withdrawal";

type DepositSource = Extract<AssetTransactionSource, "dividend" | "sipp-rebate" | "cash-top-up">;
type WithdrawalSource = Extract<AssetTransactionSource, "cash-withdrawal">;
type CashDirectionSource = DepositSource | WithdrawalSource;

const depositSources: { value: DepositSource; label: string }[] = [
  { value: "dividend", label: "Dividend" },
  { value: "sipp-rebate", label: "SIPP Rebate" },
  { value: "cash-top-up", label: "Cash Top-up" },
];

const withdrawalSources: { value: WithdrawalSource; label: string }[] = [
  { value: "cash-withdrawal", label: "Cash Withdrawal" },
];

type AddCalculatedTransactionContentProps = {
  assetId: string;
  securities: UserAssetSecuritySelect[];
  onClose: () => void;
  open: boolean;
};

export function AddCalculatedTransactionContent({
  assetId,
  securities,
  onClose,
  open,
}: AddCalculatedTransactionContentProps) {
  const [phase, setPhase] = useState<"kind" | "form">("kind");
  const [txKind, setTxKind] = useState<TxKind | null>(null);
  const [direction, setDirection] = useState<Direction>("purchase");
  const [cashSource, setCashSource] = useState<CashDirectionSource>("dividend");

  const addAssetContribution = useAssetContributionCreate(assetId);
  const { addSecurityTransaction } = useSecurityTransactions(assetId);

  useEffect(() => {
    if (!open) {
      setPhase("kind");
      setTxKind(null);
      setDirection("purchase");
      setCashSource("dividend");
    }
  }, [open]);

  const handleDirectionChange = (value: Direction) => {
    setDirection(value);
    setCashSource(value === "withdrawal" ? "cash-withdrawal" : "dividend");
  };

  const handleCashSubmit = async (data: AssetContributionFormData) => {
    const sign = direction === "withdrawal" ? -1 : 1;
    const signed = createDecimalValueString(
      Decimal(String(data.value)).mul(sign).toString()
    );
    await addAssetContribution.mutateAsync({
      assetId,
      value: signed,
      valueDate: data.valueDate,
      currencyValue: signed,
      source: cashSource,
    });
    onClose();
  };

  const handleInvestmentSubmit = async (payload: SecurityTransactionInsert) => {
    const sign = direction === "withdrawal" ? -1 : 1;
    const adjustedPayload: SecurityTransactionInsert = {
      ...payload,
      value: createDecimalValueString(
        Decimal(String(payload.value)).mul(sign).toString()
      ),
      currencyValue: createDecimalValueString(
        Decimal(String(payload.currencyValue)).mul(sign).toString()
      ),
    };
    await addSecurityTransaction.mutateAsync(adjustedPayload);
    onClose();
  };

  const directionLabels =
    txKind === "cash"
      ? { purchase: "Deposit / in", withdrawal: "Withdraw / out" }
      : { purchase: "Buy", withdrawal: "Sell" };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add transaction</DialogTitle>
        <DialogDescription>
          {phase === "kind"
            ? "Choose whether this is a cash or received transaction, or an investment trade."
            : txKind === "cash"
              ? "Cash and received — record money into or out of this account."
              : "Investment transaction — record a buy or sell for a holding."}
        </DialogDescription>
      </DialogHeader>

      {phase === "kind" ? (
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-border p-5 text-left hover:border-primary hover:bg-primary/5 transition-colors"
              onClick={() => {
                setTxKind("cash");
                setPhase("form");
              }}
            >
              <Coins className="h-7 w-7 text-muted-foreground" />
              <span className="text-sm font-medium">Cash and Received</span>
            </button>
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-border p-5 text-left hover:border-primary hover:bg-primary/5 transition-colors"
              onClick={() => {
                setTxKind("investment");
                setPhase("form");
              }}
            >
              <Layers2 className="h-7 w-7 text-muted-foreground" />
              <span className="text-sm font-medium">Investment</span>
            </button>
          </div>
          <div className="flex justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <RadioGroup
              value={direction}
              onValueChange={(v) => handleDirectionChange(v as Direction)}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="purchase" id="dir-purchase" />
                <Label
                  htmlFor="dir-purchase"
                  className="font-normal cursor-pointer"
                >
                  {directionLabels.purchase}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="withdrawal" id="dir-withdrawal" />
                <Label
                  htmlFor="dir-withdrawal"
                  className="font-normal cursor-pointer"
                >
                  {directionLabels.withdrawal}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {txKind === "cash" ? (
            <div className="space-y-2">
              <Label htmlFor="cash-source">Source</Label>
              <Select
                value={cashSource}
                onValueChange={(v) => setCashSource(v as CashDirectionSource)}
              >
                <SelectTrigger id="cash-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(direction === "withdrawal" ? withdrawalSources : depositSources).map(
                    ({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {txKind === "cash" ? (
            <TransactionSingleForm
              onSubmit={handleCashSubmit}
              onCancel={onClose}
            />
          ) : (
            <AssetSecurityTransactionSingleForm
              securities={securities}
              onSubmit={handleInvestmentSubmit}
              allowNewSecurity={direction === "purchase"}
              CancelButton={
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              }
            />
          )}
        </div>
      )}
    </>
  );
}
