import { UserAssetSecurityInsert } from "shared/schema";
import { FC, useState } from "react";
import { SecurityCard } from "./SecurityCard";
import { cn } from "@/lib/utils";
import { useAssetSecurities } from "@/context/AssetSecuritiesContext";
import { AssetSecurityUpsertDialog } from "./AssetSecurityUpsertDialog";

type SecuritiesListProps = {
  onItemClick?: (item: { id: string }) => void;
  className?: string;
  canAddSecurity?: boolean;
};

export const SecuritiesList: FC<SecuritiesListProps> = ({
  onItemClick,
  className,
  canAddSecurity = true,
}) => {
  const [isAddSecurityOpen, setIsAddSecurityOpen] = useState(false);

  const { securities, addSecurity, isSecuritiesLoading } = useAssetSecurities();

  const handleAddAssetSecurity = (securityInsert: UserAssetSecurityInsert) => {
    return addSecurity.mutateAsync(securityInsert);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {canAddSecurity && (
        <div className="flex justify-end">
          <AssetSecurityUpsertDialog
            isOpen={isAddSecurityOpen}
            onOpenChange={setIsAddSecurityOpen}
            onSubmit={handleAddAssetSecurity}
            data={null}
            securities={securities}
          />
        </div>
      )}
      <div>
        {isSecuritiesLoading ? (
          <div>Loading...</div>
        ) : (
          securities.map((security) => (
            <SecurityCard
              key={security.id}
              security={security}
              onClick={onItemClick ?? (() => {})}
            />
          ))
        )}
      </div>
    </div>
  );
};
