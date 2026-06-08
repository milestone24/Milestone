import { Loader2 } from "lucide-react";
import { useAssetProcesses } from "@/hooks/use-asset-processes";

type AssetProcessIndicatorProps = {
  assetId: string | undefined;
};

export function AssetProcessIndicator({ assetId }: AssetProcessIndicatorProps) {
  const { hasActiveProcesses } = useAssetProcesses(assetId);

  if (!hasActiveProcesses) {
    return null;
    // return (
    //   <div className="bg-card rounded-lg px-4 py-3 mb-4 flex items-center gap-2 text-sm text-muted-foreground">
    //     <span>No active processes</span>
    //   </div>
    // );
  }

  return (
    <div className="bg-warning-surface rounded-lg px-4 py-3 mb-4 flex items-center gap-2 text-sm text-warning">
      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      <span>We are currently updating your financial data</span>
    </div>
  );
}
