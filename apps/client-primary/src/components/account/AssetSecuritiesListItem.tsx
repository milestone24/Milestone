import { FC, useCallback, useState } from "react";
import {
  ResolvedAssetSecurity,
  UserAssetSecurityOrphanLinkInsert,
} from "@milestone/js-common/schema";
import { Button } from "../ui/button";
import { Info, Loader2, Pencil, Trash2 } from "lucide-react";
import { PosNegNumber } from "../common/PosNegNumber";
import { useAssetSecurities } from "@/context/AssetSecuritiesContext";
import { AssetSecurityUpsertDialog } from "./AssetSecurityUpsertDialog";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogContent,
  AlertDialogFooter,
} from "../ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "../ui/sheet";

type AssetSecuritiesListItemProps = {
  security: ResolvedAssetSecurity;
  onClick: (item: { id: string }) => void;
};

export const AssetSecuritiesListItem: FC<AssetSecuritiesListItemProps> = ({
  security,
  onClick,
}) => {
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { deleteSecurity, updateSecurity, assetStartDate } =
    useAssetSecurities();

  const [isDeletingOpen, setIsDeletingOpen] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  const continueDelete = () => {
    setIsDeleting(true);
    return deleteSecurity
      .mutateAsync(security.id)
      .then(() => {
        setIsDeleting(false);
      })
      .catch((error) => {
        setIsDeleting(false);
        return Promise.reject(error);
      });
  };

  const handleDelete = () => {
    setIsDeletingOpen(true);
  };

  const handleEdit = () => {
    setIsEditOpen(true);
  };

  const handleEditSubmit = useCallback(
    async (securityInsert: UserAssetSecurityOrphanLinkInsert) => {
      return updateSecurity
        .mutateAsync({
          id: security.id,
          security: {
            ...securityInsert,
            userAssetId: security.id,
          },
        })
        .then(() => {
          //Temporrary to return void to match expected return type
          return Promise.resolve();
        })
        .catch((error) => {
          return Promise.reject(error);
        });
    },
    [updateSecurity, security],
  );

  console.log("AssetSecuritiesListItem security", security);

  return (
    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
      <div
        className="flex flex-1 flex-row justify-between cursor-pointer mr-4"
        onClick={() => onClick(security)}
      >
        <div className="flex flex-col items-start">
          <p className="font-medium">{security.security.name}</p>
          <p className="text-sm text-muted-foreground">
            {security.security.symbol}
          </p>
          <p className="text-sm text-muted-foreground">
            {security.startDate.toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <p className="font-medium">
            £{Number(security.calculatedValue.value).toLocaleString()}
          </p>
          <span className="inline-flex items-center gap-x-1">
            <PosNegNumber
              value={Number(security.calculatedValue.currentChange)}
            />
            <span className="text-sm text-muted-foreground">(</span>
            <PosNegNumber
              value={Number(security.calculatedValue.currentChangePercentage)}
              displayInPercentage
            />
            <span className="text-sm text-muted-foreground">)</span>
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Info className="h-3 w-3" />
                </button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Daily change</SheetTitle>
                  <SheetDescription>
                    How the change values are calculated
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-4 text-sm">
                  <p>
                    The change values shown are based on the two most recent
                    daily closing prices available for this security.
                  </p>
                  <p>
                    <span className="font-medium">Change (£)</span> is the
                    difference between the latest and previous closing price,
                    multiplied by the number of shares held.
                  </p>
                  <p>
                    <span className="font-medium">Change (%)</span> is
                    calculated using the Time-Weighted Return (TWR) method
                    between those same two closing prices.
                  </p>
                  <p className="text-muted-foreground">
                    If both values are showing as zero, the closing price did
                    not change between the two most recent trading days in your
                    price history.
                  </p>
                  <p className="text-muted-foreground">
                    Prices are sourced from your locally synced price history.
                    Use the refresh button on this page to fetch the latest
                    prices.
                  </p>
                </div>
              </SheetContent>
            </Sheet>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleEdit}
          disabled={isDeleting}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
      <AlertDialog
        open={isDeletingOpen}
        onOpenChange={(open) => !open && setIsDeletingOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Investment</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all data associated with this investment. This
              action cannot be undone. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => continueDelete()}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AssetSecurityUpsertDialog
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSubmit={handleEditSubmit}
        data={security}
        securities={undefined}
        startDate={assetStartDate}
        startDateIsEditable={true}
        startDateMin={assetStartDate}
      />
    </div>
  );
};
