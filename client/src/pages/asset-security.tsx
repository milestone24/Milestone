import { useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { usePortfolio } from "@/context/PortfolioContext";
import { AssetValue, ResolvedAssetSecurity } from "shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionsPanel } from "@/components/account/TransactionsPanel";

// Form schema for history entry
const historySchema = z.object({
  value: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Value must be a positive number",
  }),
  recordedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date",
  }),
});

export default function AssetSecurityPage() {
  const params = useParams();

  console.log("params", params);
  const assetId: string | undefined = params?.id;
  const nestedId: string | undefined = params?.nestedId;

  const { addAssetValue, updateAssetValue, deleteAssetValue } = usePortfolio();

  // State for history (values) tab
  const [isAddHistoryOpen, setIsAddHistoryOpen] = useState(false);
  const [isEditHistoryOpen, setIsEditHistoryOpen] = useState(false);
  const [historyToDelete, setHistoryToDelete] = useState<string | null>(null);
  const [historyToEdit, setHistoryToEdit] = useState<any>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState<"values" | "contributions">(
    "values"
  );

  const {
    data: asset,
    isLoading: isAssetLoading,
    isError: isAssetError,
    error: assetError,
  } = useQuery<ResolvedAssetSecurity>({
    queryKey: ["asset", assetId, "security", nestedId],
    queryFn: () =>
      apiRequest<ResolvedAssetSecurity>(
        "GET",
        `/api/assets/${assetId}/securities/${nestedId}`
      ),
  });

  const { data: history, isLoading: isHistoryLoading } = useQuery<AssetValue[]>(
    {
      queryKey: ["asset", assetId, "security", nestedId, "history"],
      queryFn: () =>
        apiRequest<AssetValue[]>("GET", `/api/assets/${assetId}/history`),
    }
  );

  if (isAssetLoading || isHistoryLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center mb-6">
              <Skeleton className="w-10 h-10 rounded-md mr-3" />
              <div>
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="space-y-4">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-4">
            <p className="text-center text-muted-foreground">Security not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col items-start mb-6">
        <div className="flex items-center gap-2">
          <div>
            <div className="mb-2">
              <h1 className="text-xl ">
                {asset.security?.name ?? "Unknown Security"}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Current Value */}
      <div className="mb-6">
        <h2 className="text-lg font-medium mb-2">Current Value</h2>
      </div>

      {/* Tabs for Values/Contributions */}
      <TransactionsPanel assetId={assetId ?? ""} />
    </div>
  );
}
