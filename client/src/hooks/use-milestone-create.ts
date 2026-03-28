import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import {
  AccountType,
  Milestone,
  MilestoneInsert,
  MilestoneOrphanInsert,
} from "@shared/schema";
import { useSession } from "@/hooks/use-session";
import { getMilestonesQueryKey } from "@/hooks/use-milestones";

export const useMilestoneCreate = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation<Milestone, Error, MilestoneOrphanInsert>({
    mutationFn: async (newMilestone) => {
      if (!user?.account.id) {
        throw new Error("User account ID is required");
      }
      const processedMilestone: MilestoneInsert = {
        ...newMilestone,
        userAccountId: user.account.id,
        accountType:
          newMilestone.accountType === "ALL"
            ? null
            : (newMilestone.accountType as AccountType),
      };
      return apiRequest<Milestone>("POST", "/api/milestones", processedMilestone);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getMilestonesQueryKey(user?.account.id),
      });
      toast({
        title: "Milestone added",
        description: "Your investment milestone has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding milestone",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
