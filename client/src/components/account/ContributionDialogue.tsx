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
import { ContributionRecurringForm } from "./ContributionRecurringForm";
import {
  RecurringContributionFormData,
  SingleContributionFormData,
  isAssetContribution,
  isRecurringContribution,
} from "@shared/schema/contribution";
import { ContributionSingleForm } from "./ContributionSingleForm";
import { AssetContribution } from "@shared/schema/portfolio-assets";
import { RecurringContribution } from "@shared/schema/portfolio-assets";

type ContributionDialogueProps<
  T extends SingleContributionFormData | RecurringContributionFormData =
    | SingleContributionFormData
    | RecurringContributionFormData,
  S extends (data: T, contributionId?: string) => Promise<T> = (
    data: T,
    contributionId?: string
  ) => Promise<T & { id: string }>,
  D extends AssetContribution | RecurringContribution | null =
    | AssetContribution
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

export const ContributionDialogue = ({
  isOpen,
  onOpenChange,
  onSubmit,
  data,
}: ContributionDialogueProps) => {
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
    values: SingleContributionFormData
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
              <ContributionSingleForm
                onSubmit={handleSingleContributionSubmit}
              />
            </TabsContent>

            <TabsContent value="recurring">
              <ContributionRecurringForm
                onSubmit={handleRecurringContributionSubmit}
              />
            </TabsContent>
          </Tabs>
        ) : isAssetContribution(data) ? (
          <ContributionSingleForm
            onSubmit={handleSingleContributionSubmit}
            data={data}
          />
        ) : isRecurringContribution(data) ? (
          <ContributionRecurringForm
            onSubmit={handleRecurringContributionSubmit}
            data={data}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
