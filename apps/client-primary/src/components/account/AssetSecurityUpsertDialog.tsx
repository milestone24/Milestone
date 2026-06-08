import {
  ResolvedAssetSecurity,
  UserAssetSecurityOrphanNewCreateInsert,
  UserAssetSecurityOrphanLinkInsert,
} from "@milestone/js-common/schema/portfolio-assets";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  AssetSecurityEditForm,
  AssetSecurityNewForm,
} from "./AssetSecurityForm";
import { useCallback } from "react";

type AssetSecurityUpsertDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: Date | undefined;
  startDateMin: Date | undefined;
  startDateIsEditable: boolean;
} & (
  | {
      data: undefined;
      onSubmit: (
        securityInsert: UserAssetSecurityOrphanNewCreateInsert
      ) => Promise<void>;
      securities: ResolvedAssetSecurity[];
    }
  | {
      data: ResolvedAssetSecurity;
      onSubmit: (
        securityInsert: UserAssetSecurityOrphanLinkInsert
      ) => Promise<void>;
      securities: undefined;
    }
);

export const AssetSecurityUpsertDialog = ({
  isOpen,
  onOpenChange,
  startDate,
  startDateIsEditable,
  startDateMin,
  onSubmit,
  data,
}: AssetSecurityUpsertDialogProps) => {
  const handleSubmit = useCallback(
    async <T extends (...args: any[]) => Promise<any>>(
      func: T,
      ...args: Parameters<T>
    ) => {
      return func(...args)
        .then(() => {
          onOpenChange(false);
        })
        .catch((error) => {
          return Promise.reject(error);
        });
    },
    [onSubmit, onOpenChange]
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{data ? "Edit Security" : "Add Security"}</DialogTitle>
          <DialogDescription>
            {data
              ? "Edit a security in this account."
              : "Add a new security to this account."}
          </DialogDescription>
        </DialogHeader>
        {data ? (
          <AssetSecurityEditForm
            onSubmit={(value) => handleSubmit(onSubmit, value)}
            onCancel={() => onOpenChange(false)}
            startDateIsEditable={startDateIsEditable}
            startDateMin={startDateMin}
            data={data}
          />
        ) : (
          <AssetSecurityNewForm
            onSubmit={(value) => handleSubmit(onSubmit, value)}
            onCancel={() => onOpenChange(false)}
            startDate={startDate}
            startDateMin={startDateMin}
            startDateIsEditable={startDateIsEditable}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
