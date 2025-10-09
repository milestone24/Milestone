import { FC, useState } from "react";
import { ResolvedSecurity } from "shared/schema";
import { twMerge } from "tailwind-merge";
import { Button } from "../ui/button";
import { Pencil, Trash } from "lucide-react";
import { useAssetSecurities } from "@/context/AssetSecuritiesContext";

type SecurityCardProps = {
  security: ResolvedSecurity;
  onClick: (item: { id: string }) => void;
};

export const SecurityCard: FC<SecurityCardProps> = ({ security, onClick }) => {
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { deleteSecurity } = useAssetSecurities();

  const handleDelete = () => {
    console.log("delete", security);
  };

  const handleEdit = () => {
    console.log("edit", security);
  };

  return (
    <div className="flex flex-row gap-2 w-full">
      <div
        className={"flex flex-1 flex-row justify-between cursor-pointer"}
        onClick={() => onClick(security)}
      >
        <div className="flex flex-col items-start">
          <div className="text-sm font-medium">{security.security.name}</div>
          <div className="text-sm text-gray-500">
            {security.security.symbol}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-sm font-medium">
            {security.calculatedValue.value}
          </div>
          <div className="text-sm text-gray-500">
            {security.calculatedValue.currentChange}
          </div>
        </div>
      </div>
      <div className="flex flex-0 flex-row gap-2">
        <Button variant="outline" size="sm">
          <Pencil className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
