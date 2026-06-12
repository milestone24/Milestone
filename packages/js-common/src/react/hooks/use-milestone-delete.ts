import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { useNotifications } from '../notifications/useNotifications';
import { Milestone } from "../../schema";
import { useSession } from "./use-session";
import { getMilestonesQueryKey } from "./use-milestones";

export const useMilestoneDelete = () => {
  const { notify } = useNotifications();
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation<void, Error, Milestone["id"]>({
    mutationFn: (id) => apiRequest("DELETE", `/api/milestones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getMilestonesQueryKey(user?.account.id),
      });
      notify({
        title: "Milestone deleted",
        description: "Your investment milestone has been deleted successfully.",
      });
    },
    onError: (error) => {
      notify({
        title: "Error deleting milestone",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
