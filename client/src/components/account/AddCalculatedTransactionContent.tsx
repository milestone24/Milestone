import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coins, Layers2, Percent, PiggyBank } from "lucide-react";
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

type TxKind = "cash" | "investment" | "dividend" | "sipp-rebate";
type Direction = "purchase" | "withdrawal";

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

  const addAssetContribution = useAssetContributionCreate(assetId);
  const { addSecurityTransaction } = useSecurityTransactions(assetId);

  useEffect(() => {
    if (!open) {
      setPhase("kind");
      setTxKind(null);
      setDirection("purchase");
    }
  }, [open]);

  const resolveSource = (): AssetTransactionSource => {
    if (txKind === "dividend") return "dividend";
    if (txKind === "sipp-rebate") return "sipp-rebate";
    return direction === "withdrawal" ? "cash-withdrawal" : "cash-top-up";
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
      source: resolveSource(),
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

  const isCashKind = txKind === "cash" || txKind === "dividend" || txKind === "sipp-rebate";
  const showDirectionToggle = txKind === "cash" || txKind === "investment";

  const directionLabels =
    txKind === "cash"
      ? { purchase: "Deposit / in", withdrawal: "Withdraw / out" }
      : { purchase: "Buy", withdrawal: "Sell" };

  const formDescription = () => {
    if (txKind === "dividend") return "Dividend — record a dividend received into this account.";
    if (txKind === "sipp-rebate") return "SIPP rebate — record a government tax rebate into this account.";
    if (txKind === "cash") return "Cash — record money into or out of this account.";
    return "Investment transaction — record a buy or sell for a holding.";
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add transaction</DialogTitle>
        <DialogDescription>
          {phase === "kind"
            ? "Select the type of transaction you want to record."
            : formDescription()}
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
              <span className="text-sm font-medium">Cash</span>
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
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-border p-5 text-left hover:border-primary hover:bg-primary/5 transition-colors"
              onClick={() => {
                setTxKind("dividend");
                setPhase("form");
              }}
            >
              <Percent className="h-7 w-7 text-muted-foreground" />
              <span className="text-sm font-medium">Dividend</span>
            </button>
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-border p-5 text-left hover:border-primary hover:bg-primary/5 transition-colors"
              onClick={() => {
                setTxKind("sipp-rebate");
                setPhase("form");
              }}
            >
              <PiggyBank className="h-7 w-7 text-muted-foreground" />
              <span className="text-sm font-medium">SIPP Rebate</span>
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
          {showDirectionToggle && (
            <div className="space-y-2">
              <RadioGroup
                value={direction}
                onValueChange={(v) => setDirection(v as Direction)}
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
          )}

          {isCashKind ? (
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
