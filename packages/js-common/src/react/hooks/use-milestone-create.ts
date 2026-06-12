import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { useNotifications } from '../notifications/useNotifications';
import {
  AccountType,
  Milestone,
  MilestoneInsert,
  MilestoneOrphanInsert,
} from "../../schema";
import { useSession } from "./use-session";
import { getMilestonesQueryKey } from "./use-milestones";

export const useMilestoneCreate = () => {
  const { notify } = useNotifications();
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
      notify({
        title: "Milestone added",
        description: "Your investment milestone has been added successfully.",
      });
    },
    onError: (error) => {
      notify({
        title: "Error adding milestone",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
