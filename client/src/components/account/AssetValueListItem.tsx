import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AssetValue } from "@shared/schema";
import { useAssetValues } from "@/hooks/use-asset-values";
import { cn } from "@/lib/utils";
import { AssetValueUpsertDialog } from "./AssetValueUpsertDialog";

type AssetValueListItemProps = {
  value: AssetValue;
  assetId: string;
  readOnly?: boolean;
};

export const AssetValueListItem = ({
  value,
  assetId,
  readOnly = false,
}: AssetValueListItemProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { deleteAssetValue, updateAssetValue } = useAssetValues(assetId);

  const handleDelete = async () => {
    await deleteAssetValue.mutateAsync({
      historyId: value.id,
    });
    setIsDeleteOpen(false);
  };

  const isDeleting = deleteAssetValue.isPending;
  const isUpdating = updateAssetValue.isPending;
  const isBusy = isDeleting || isUpdating;

  return (
    <>
      <div
        className={cn(
          "flex justify-between items-center p-4 bg-gray-50 rounded-lg transition-opacity",
          isBusy && "opacity-50 pointer-events-none"
        )}
      >
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">
              £{Number(value.value).toLocaleString()}
            </p>
            {isBusy && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            )}
          </div>
          <p className="text-sm text-gray-600">
            {new Date(value.valueDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsEditOpen(true)}
              disabled={isBusy}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setIsDeleteOpen(true)}
              disabled={isBusy}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Edit Dialog - only render when not readOnly */}
      {!readOnly && (
        <AssetValueUpsertDialog
          isOpen={isEditOpen}
          onOpenChange={setIsEditOpen}
          data={value}
          assetId={assetId}
        />
      )}

      {/* Delete Confirmation Dialog - only render when not readOnly */}
      {!readOnly && (
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete History Entry</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this history entry? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
};
