import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { useNotifications } from '../notifications/useNotifications';
import { Milestone, MilestoneOrphanInsert } from "../../schema";
import { useSession } from "./use-session";
import { getMilestonesQueryKey } from "./use-milestones";

type MilestoneUpdate = MilestoneOrphanInsert & {
  id: Milestone["id"];
};

export const useMilestoneUpdate = () => {
  const { notify } = useNotifications();
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation<Milestone, Error, MilestoneUpdate>({
    mutationFn: (data) => apiRequest("PATCH", `/api/milestones/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getMilestonesQueryKey(user?.account.id),
      });
      notify({
        title: "Success",
        description: "Milestone updated successfully",
      });
    },
    onError: (error) => {
      notify({
        title: "Error",
        description: `Failed to update milestone: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};
