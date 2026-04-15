import { useState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExtractedAmount } from "@shared/schema/document";
import type { UserAsset } from "@shared/schema";

interface ExtractedAmountEdit extends ExtractedAmount {
  editedAmount: number;
  matchedAssetId?: string;
}

interface OcrBalanceReviewProps {
  extractedValues: ExtractedAmount[];
  assets: UserAsset[];
  onSave: (data: { assetId: string; value: number }[]) => void;
}

export function OcrBalanceReview({ extractedValues, assets, onSave }: OcrBalanceReviewProps) {
  const [editedValues, setEditedValues] = useState<ExtractedAmountEdit[]>(() =>
    extractedValues.map((v) => ({ ...v, editedAmount: v.amount }))
  );

  if (extractedValues.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0" />
        No account balances could be extracted from this document.
      </div>
    );
  }

  const handleAmountChange = (index: number, value: string) => {
    setEditedValues((prev) =>
      prev.map((v, i) => (i === index ? { ...v, editedAmount: parseFloat(value) || 0 } : v))
    );
  };

  const handleAssetMatch = (index: number, assetId: string) => {
    setEditedValues((prev) =>
      prev.map((v, i) => (i === index ? { ...v, matchedAssetId: assetId } : v))
    );
  };

  const handleSave = () => {
    const mapped = editedValues
      .filter((v) => v.matchedAssetId)
      .map((v) => ({ assetId: v.matchedAssetId!, value: v.editedAmount }));
    onSave(mapped);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Extracted balances — review and confirm</p>

      {editedValues.map((v, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{v.platformName}</span>
            {v.accountType && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {v.accountType}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Amount</span>
            <Input
              type="number"
              value={v.editedAmount}
              onChange={(e) => handleAmountChange(i, e.target.value)}
              className="h-7 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Asset</span>
            <Select
              value={v.matchedAssetId ?? ""}
              onValueChange={(val) => handleAssetMatch(i, val)}
            >
              <SelectTrigger className="h-7 text-sm">
                <SelectValue placeholder="Match to asset…" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">
            Confidence: {Math.round(v.confidence * 100)}%
          </div>
        </div>
      ))}

      <Button onClick={handleSave} className="w-full">
        <Check className="h-4 w-4 mr-2" />
        Save extracted balances
      </Button>
    </div>
  );
}
