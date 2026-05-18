import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coins, Layers2 } from "lucide-react";
import { TransactionSingleForm } from "./TransactionSingleForm";
import { AssetSecurityTransactionSingleForm } from "./AssetSecurityTransactionSingleForm";
import { useAssetContributionCreate } from "@/hooks/use-asset-contribution-create";
import { useSecurityTransactions } from "@/hooks/use-security-transactions";
import type {
  AssetContributionFormData,
  SecurityTransactionInsert,
  UserAssetSecuritySelect,
} from "@shared/schema";
import { createDecimalValueString } from "@shared/schema";

type TxKind = "cash" | "investment";
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
            ? "Choose whether this is a cash movement or an investment trade."
            : txKind === "cash"
              ? "Cash transaction — record money into or out of this account."
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
              <span className="text-sm font-medium">Cash movement</span>
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
