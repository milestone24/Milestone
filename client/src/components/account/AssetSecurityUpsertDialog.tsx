import { securities, UserAssetSecuritySelect } from "@server/db/schema";
import { SecurityTransactionUpsert } from "@shared/schema";
import {
  ResolvedSecurity,
  UserAssetSecurityInsert,
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
import { AssetSecurityForm } from "./AssetSecurityForm";

type AssetSecurityUpsert = {
  securityId: string;
  securityName: string;
  securitySymbol: string;
  securityType: string;
  securityCurrency: string;
  securityValue: number;
};

type AssetSecurityUpsertDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    securityInsert: UserAssetSecurityInsert
  ) => Promise<UserAssetSecuritySelect>;
  data: UserAssetSecuritySelect | null;
  securities: ResolvedSecurity[];
};

export const AssetSecurityUpsertDialog = ({
  isOpen,
  onOpenChange,
  onSubmit,
  data,
}: AssetSecurityUpsertDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          {"Add Security"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{data ? "Edit Security" : "Add Security"}</DialogTitle>
          <DialogDescription>
            Add a new security to this account.
          </DialogDescription>
        </DialogHeader>
        <AssetSecurityForm
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />

        {/* <SecurityTransactionSingleForm
          onSubmit={handleTransactionSubmit}
          securities={securities}
        /> */}
      </DialogContent>
    </Dialog>
  );
};
