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
    <div className={cn("flex flex-col", className)}>
      {canAddSecurity && (
        <div className="flex justify-end mb-4">
          <AssetSecurityUpsertDialog
            isOpen={isAddSecurityOpen}
            onOpenChange={setIsAddSecurityOpen}
            onSubmit={handleAddAssetSecurity}
            data={null}
            securities={securities}
          />
        </div>
      )}
      <div className="space-y-4">
        {isSecuritiesLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-lg animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : securities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No securities in this account.
          </div>
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
