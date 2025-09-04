import {
  ResolvedSecurity,
  WithSecurities,
  WithSecurity,
} from "shared/schema";
import { FC } from "react";
import { SecurityCard } from "./SecurityCard";
import { cn } from "@/lib/utils";

type SecuritiesListProps = {
  securities: ResolvedSecurity[];
  onItemClick?: (item: { id: string }) => void;
  className?: string;
};

export const SecuritiesList: FC<SecuritiesListProps> = ({
  securities,
  onItemClick,
  className,
}) => {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {securities.map((security) => (
        <SecurityCard
          key={security.id}
          security={security}
          onClick={onItemClick ?? (() => {})}
        />
      ))}
    </div>
  );
};
