import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionRecurringForm } from "./TransactionRecurringForm";
import type {
  RecurringContributionFormData,
  AssetContributionFormData,
  AssetTransaction,
  RecurringContribution,
} from "@shared/schema";
import { TransactionSingleForm } from "./TransactionSingleForm";
import {
  isAssetContribution,
  isRecurringContribution,
} from "@shared/schema/transaction";

type TransactionsDialogueProps<
  T extends AssetContributionFormData | RecurringContributionFormData =
    | AssetContributionFormData
    | RecurringContributionFormData,
  S extends (data: T, contributionId?: string) => Promise<T> = (
    data: T,
    contributionId?: string
  ) => Promise<T & { id: string }>,
  D extends AssetTransaction | RecurringContribution | null =
    | AssetTransaction
    | RecurringContribution
    | null
> =
  | {
      isOpen: true;
      onOpenChange: (open: boolean) => void;
      onSubmit: S;
      data?: D;
    }
  | {
      isOpen: false;
      onOpenChange?: (open: boolean) => void;
      onSubmit?: S;
      data?: D;
    };

export const TransactionsDialogue = ({
  isOpen,
  onOpenChange,
  onSubmit,
  data,
}: TransactionsDialogueProps) => {
  // Form for adding/editing contributions

  // Handlers for contributions
  // const handleCreateContribution = async (
  //   values: z.infer<typeof contributionSchema>
  // ) => {
  //   if (!assetId) return;

  //   try {
  //     await addBrokerAssetContribution.mutateAsync({
  //       assetId: assetId,
  //       value: Number(values.value),
  //       recordedAt: new Date(values.recordedAt),
  //     });
  //     contributionForm.reset();
  //   } catch (error) {
  //     console.error("Error creating contribution:", error);
  //   }
  // };

  const handleRecurringContributionSubmit = async (
    values: RecurringContributionFormData
  ) => {
    if (!onSubmit) return;
    await onSubmit(values, data?.id);
  };

  const handleSingleContributionSubmit = async (
    values: AssetContributionFormData
  ) => {
    if (!onSubmit) return;
    await onSubmit(values, data?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          {"Add Contribution"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {data ? "Edit Contribution" : "Add Contribution"}
          </DialogTitle>
          <DialogDescription>
            Record a new contribution to this account.
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <Tabs defaultValue="single" className="mt-4">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="single">Single</TabsTrigger>
              <TabsTrigger value="recurring">Recurring</TabsTrigger>
            </TabsList>

            <TabsContent value="single">
              <TransactionSingleForm
                onSubmit={handleSingleContributionSubmit}
                onCancel={() => onOpenChange?.(false)}
              />
            </TabsContent>

            <TabsContent value="recurring">
              <TransactionRecurringForm
                onSubmit={handleRecurringContributionSubmit}
                onCancel={() => onOpenChange?.(false)}
              />
            </TabsContent>
          </Tabs>
        ) : isAssetContribution(data) ? (
          <TransactionSingleForm
            onSubmit={handleSingleContributionSubmit}
            onCancel={() => onOpenChange?.(false)}
            data={data}
          />
        ) : isRecurringContribution(data) ? (
          <TransactionRecurringForm
            onSubmit={handleRecurringContributionSubmit}
            onCancel={() => onOpenChange?.(false)}
            data={data}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
