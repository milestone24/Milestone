import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, X, Pencil, AlertCircle } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMilestones } from "@/hooks/use-milestones";
import { useMilestoneCreate } from "@/hooks/use-milestone-create";
import { useMilestoneDelete } from "@/hooks/use-milestone-delete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AISuggestedMilestones from "@/components/milestones/AISuggestedMilestones";
import { useSession } from "@/context/SessionContext";
import { EditMilestoneDialog } from "@/components/milestones/EditMilestoneDialog";
import {
  Milestone,
  MilestoneOrphanInsert,
  AccountType,
  createDecimalValueString,
} from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePortfolioOverview } from "@/hooks/use-portfolio-overview";
import { useAssets } from "@/hooks/use-assets";

// Form schema for adding a new milestone
const milestoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  accountType: z.string().optional(),
  targetValue: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Target value must be a positive number",
    }),
});

export default function Goals() {
  const { milestones, isLoading } = useMilestones();
  const addMilestone = useMilestoneCreate();
  const deleteMilestone = useMilestoneDelete();

  const { data: assets = [], isLoading: isLoadingAssets } = useAssets();

  const { data: portfolioOverview } = usePortfolioOverview();

  const { user } = useSession();

  // Get the unique account types that exist in the user's portfolio
  const availableAccountTypes = useMemo(() => {
    const types = new Set<AccountType | "ALL">();
    types.add("ALL"); // Always include "ALL" as an option

    assets.forEach((asset) => {
      if (asset.accountType) {
        types.add(asset.accountType as AccountType);
      }
    });

    return Array.from(types);
  }, [assets]);

  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState<string | null>(
    null
  );
  const [milestoneToEdit, setMilestoneToEdit] = useState<Milestone | null>(
    null
  );

  // Form for adding a new milestone
  const form = useForm<z.infer<typeof milestoneSchema>>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      name: "",
      accountType: "ALL",
      targetValue: "",
    },
  });

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof milestoneSchema>) => {
    if (!user) {
      throw new Error("User not found");
    }

    try {
      await addMilestone.mutateAsync({
        name: values.name,
        accountType:
          values.accountType === "ALL"
            ? null
            : (values.accountType as AccountType),
        targetValue: createDecimalValueString(values.targetValue),
      });
      setIsAddMilestoneOpen(false);
      form.reset();
    } catch (error) {
      console.error("Error adding milestone:", error);
    }
  };

  // Handle milestone deletion
  const handleDeleteMilestone = async () => {
    if (milestoneToDelete !== null) {
      try {
        await deleteMilestone.mutateAsync(milestoneToDelete);
        setMilestoneToDelete(null);
      } catch (error) {
        console.error("Error deleting milestone:", error);
      }
    }
  };

  // Get color based on account type
  const getAccountTypeColor = (type: string | null) => {
    switch (type) {
      case "ISA":
        return "text-blue-400 bg-blue-50";
      case "SIPP":
        return "text-secondary bg-green-50";
      case "LISA":
        return "text-accent bg-amber-50";
      case "GIA":
        return "text-purple-500 bg-purple-50";
      default:
        return "text-primary bg-blue-50";
    }
  };

  // Get progress percentage for a milestone
  // Convert DecimalValueString to number for calculations
  const calculateProgress = (milestone: Milestone) => {
    let currentValue = 0;

    if (milestone.accountType) {
      // Sum values of accounts with matching type
      currentValue = assets.reduce(
        (sum, asset) =>
          asset.accountType === milestone.accountType
            ? sum + Number(asset.currentValue)
            : sum,
        0
      );
    } else {
      // Use total portfolio value for general milestones
      // portfolioOverview?.value is DecimalValueString | undefined
      currentValue = portfolioOverview?.value
        ? Number(portfolioOverview.value)
        : 0;
    }

    const targetValue = Number(milestone.targetValue);
    const percentage = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;

    // Cap at 100%
    return Math.min(percentage, 100);
  };

  // Format display for progress
  // Convert DecimalValueString to number for calculations
  const formatProgressDisplay = (milestone: Milestone) => {
    let currentValue = 0;

    if (milestone.accountType) {
      // Sum values of accounts with matching type
      currentValue = assets.reduce(
        (sum, asset) =>
          asset.accountType === milestone.accountType
            ? sum + Number(asset.currentValue)
            : sum,
        0
      );
    } else {
      // Use total portfolio value for general milestones
      // portfolioOverview?.value is DecimalValueString | undefined
      currentValue = portfolioOverview?.value
        ? Number(portfolioOverview.value)
        : 0;
    }

    const targetValue = Number(milestone.targetValue);
    const percentage = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;

    // Format the display based on progress
    if (percentage >= 100) {
      return "Completed!";
    } else {
      const remaining = targetValue - currentValue;
      return `£${remaining.toLocaleString()} more needed`;
    }
  };

  return (
    <div className="goals-screen max-w-5xl mx-auto px-4 pb-20">
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-semibold">Milestones</h2>

            <Dialog
              open={isAddMilestoneOpen}
              onOpenChange={setIsAddMilestoneOpen}
            >
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary">
                  <Plus className="h-6 w-6" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Milestone</DialogTitle>
                  <DialogDescription>
                    Create a new milestone to track your investment progress.
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Milestone Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. First £100k" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {assets.length === 0 ? (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Please add at least one account in the Portfolio
                          section before creating milestones.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <FormField
                        control={form.control}
                        name="accountType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Type (Optional)</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              disabled={assets.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="All accounts (portfolio)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {/* Only show account types that exist in the user's portfolio */}
                                {availableAccountTypes.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type === "ALL"
                                      ? "All accounts (portfolio)"
                                      : type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="targetValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Value (£)</FormLabel>
                          <FormControl>
                            <DecimalInput
                              ref={field.ref}
                              value={field.value ?? undefined}
                              decimalScale={2}
                              placeholder="0.00"
                              onBlur={field.onBlur}
                              disabled={field.disabled}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={assets.length === 0 || addMilestone.isPending}
                      >
                        {addMilestone.isPending
                          ? "Adding..."
                          : assets.length === 0
                          ? "Add accounts first"
                          : "Add Milestone"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              // Skeleton loading state for milestones
              Array(3)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="bg-muted rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <Skeleton className="h-5 w-32 mb-1" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-6 w-6 rounded-full" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full mt-2" />
                    <div className="flex justify-end mt-1">
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                ))
            ) : milestones.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">No milestones added yet.</p>
                <Button
                  onClick={() => setIsAddMilestoneOpen(true)}
                  className="bg-primary text-white"
                >
                  Add Your First Milestone
                </Button>
              </div>
            ) : (
              milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{milestone.name}</h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${getAccountTypeColor(
                            milestone.accountType
                          )}`}
                        >
                          {milestone.accountType || "All Accounts"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMilestoneToEdit(milestone)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Milestone
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this milestone?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  setMilestoneToDelete(milestone.id)
                                }
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        Target: £
                        {Number(milestone.targetValue).toLocaleString()}
                      </span>
                      <span>{formatProgressDisplay(milestone)}</span>
                    </div>
                    <div className="mt-2 h-2 w-full bg-secondary/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500 ease-in-out"
                        style={{
                          width: `${calculateProgress(milestone)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Milestone Dialog */}
      {milestoneToEdit && (
        <EditMilestoneDialog
          milestone={milestoneToEdit as Milestone}
          isOpen={!!milestoneToEdit}
          onClose={() => setMilestoneToEdit(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!milestoneToDelete}
        onOpenChange={() => setMilestoneToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this milestone? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMilestone}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Suggested Milestones */}
      <AISuggestedMilestones />
    </div>
  );
}
