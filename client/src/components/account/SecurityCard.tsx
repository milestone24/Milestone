import { FC, useState } from "react";
import {
  ResolvedAssetSecurity,
  UserAssetSecurityInsert,
  UserAssetSecurityInsertLink,
} from "shared/schema";
import { Button } from "../ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useAssetSecurities } from "@/context/AssetSecuritiesContext";
import { AssetSecurityUpsertDialog } from "./AssetSecurityUpsertDialog";

type SecurityCardProps = {
  security: ResolvedAssetSecurity;
  onClick: (item: { id: string }) => void;
};

export const SecurityCard: FC<SecurityCardProps> = ({ security, onClick }) => {
  const [isEditOpen, setIsEditOpen] = useState(false);

  console.log("security", security);

  const { deleteSecurity, updateSecurity, assetStartDate } =
    useAssetSecurities();

  const handleDelete = () => {
    console.log("delete", security);
    return deleteSecurity.mutateAsync(security.id);
  };

  const handleEdit = () => {
    setIsEditOpen(true);
  };

  const handleEditSubmit = (securityInsert: UserAssetSecurityInsertLink) => {
    console.log("edit", security);
    return updateSecurity.mutateAsync({
      id: security.id,
      security: securityInsert,
    });
  };

  return (
    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
      <div
        className="flex flex-1 flex-row justify-between cursor-pointer"
        onClick={() => onClick(security)}
      >
        <div className="flex flex-col items-start">
          <p className="font-medium">{security.security.name}</p>
          <p className="text-sm text-gray-600">{security.security.symbol}</p>
        </div>
        <div className="flex flex-col items-end">
          <p className="font-medium">
            £{Number(security.calculatedValue.value).toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">
            {Number(security.calculatedValue.currentChange) >= 0 ? "+" : ""}
            {Number(security.calculatedValue.currentChange).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
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
