import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TransactionSingleForm } from "./TransactionSingleForm";
import { SecurityTransactionSingleForm } from "./SecurityTransactionSingleForm";
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

type AddCalculatedTransactionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  securities: UserAssetSecuritySelect[];
};

export function AddCalculatedTransactionDialog({
  open,
  onOpenChange,
  assetId,
  securities,
}: AddCalculatedTransactionDialogProps) {
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

  const close = () => onOpenChange(false);

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
    close();
  };

  const handleInvestmentSubmit = async (data: SecurityTransactionInsert) => {
    const { assetSecurityId, valueDate, fees, currency, recordedAt, source, flags } =
      data;
    let value = Decimal(String(data.value));
    let currencyValue = Decimal(String(data.currencyValue));
    if (direction === "withdrawal") {
      value = value.abs().neg();
      currencyValue = currencyValue.abs();
    }
    await addSecurityTransaction.mutateAsync({
      securityId: assetSecurityId,
      data: {
        value: createDecimalValueString(value.toString()),
        currencyValue: createDecimalValueString(currencyValue.toString()),
        valueDate,
        fees: fees ?? undefined,
        currency: currency ?? "GBP",
        recordedAt: recordedAt ?? undefined,
        source: source ?? undefined,
        flags: flags ?? undefined,
      },
    });
    close();
  };

  const directionLabels =
    txKind === "cash"
      ? { purchase: "Deposit / in", withdrawal: "Withdraw / out" }
      : { purchase: "Buy", withdrawal: "Sell" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[min(90vh,720px)] overflow-y-auto">
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
          <div className="space-y-4 py-2">
            <RadioGroup
              value={txKind ?? ""}
              onValueChange={(v) => setTxKind(v as TxKind)}
              className="grid gap-3"
            >
              <div className="flex items-center space-x-2 rounded-md border p-3">
                <RadioGroupItem value="cash" id="tx-cash" />
                <Label htmlFor="tx-cash" className="font-normal cursor-pointer">
                  Cash movement
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-md border p-3">
                <RadioGroupItem value="investment" id="tx-inv" />
                <Label htmlFor="tx-inv" className="font-normal cursor-pointer">
                  Investment
                </Label>
              </div>
            </RadioGroup>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!txKind}
                onClick={() => setPhase("form")}
              >
                Continue
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {txKind === "cash" ? "Movement" : "Trade side"}
              </Label>
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

            <Button
              type="button"
              variant="ghost"
              className="w-full -mt-2"
              onClick={() => setPhase("kind")}
            >
              Back
            </Button>

            {txKind === "cash" ? (
              <TransactionSingleForm
                onSubmit={handleCashSubmit}
                onCancel={close}
              />
            ) : (
              <SecurityTransactionSingleForm
                securities={securities}
                onSubmit={handleInvestmentSubmit}
                CancelButton={
                  <Button type="button" variant="outline" onClick={close}>
                    Cancel
                  </Button>
                }
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
