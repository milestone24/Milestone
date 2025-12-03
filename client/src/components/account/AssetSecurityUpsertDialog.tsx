import { securities, UserAssetSecuritySelect } from "@server/db/schema";
import { SecurityTransactionUpsert } from "@shared/schema";
import {
  ResolvedAssetSecurity,
  UserAssetSecurityInsertLink,
  UserAssetSecurityWithInitialValuesInsert,
} from "@shared/schema/portfolio-assets";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Plus } from "lucide-react";
import {
  AssetSecurityEditForm,
  AssetSecurityNewForm,
} from "./AssetSecurityForm";

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
        securityInsert: UserAssetSecurityWithInitialValuesInsert
      ) => Promise<UserAssetSecuritySelect>;
      securities: ResolvedAssetSecurity[];
    }
  | {
      data: ResolvedAssetSecurity;
      onSubmit: (
        securityInsert: UserAssetSecurityInsertLink
      ) => Promise<UserAssetSecuritySelect>;
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
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          {"Add Security"}
        </Button>
      </DialogTrigger> */}
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
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            startDateIsEditable={startDateIsEditable}
            startDateMin={startDateMin}
            data={data}
          />
        ) : (
          <AssetSecurityNewForm
            onSubmit={onSubmit}
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
