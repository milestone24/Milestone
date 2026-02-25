import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssetValue } from "@shared/schema";
import { AssetValueListItem } from "./AssetValueListItem";
import { AssetValueUpsertDialog } from "./AssetValueUpsertDialog";

type AssetValueListProps = {
  values: AssetValue[];
  assetId: string;
  isLoading?: boolean;
  readOnly?: boolean;
};

export const AssetValueList = ({
  values,
  assetId,
  isLoading,
  readOnly = false,
}: AssetValueListProps) => {
  const [isAddOpen, setIsAddOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-muted rounded-lg animate-pulse">
            <div className="h-5 bg-muted rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">History</h2>
        {!readOnly && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center"
              onClick={() => setIsAddOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Value
            </Button>
            <AssetValueUpsertDialog
              isOpen={isAddOpen}
              onOpenChange={setIsAddOpen}
              data={null}
              assetId={assetId}
            />
          </>
        )}
      </div>

      {/* Empty state */}
      {(!values || values.length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          No account value history available.
        </div>
      )}

      {/* List items */}
      {values.map((value) => (
        <AssetValueListItem
          key={value.id}
          value={value}
          assetId={assetId}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
};
