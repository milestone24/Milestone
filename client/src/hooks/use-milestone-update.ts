import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Milestone, MilestoneOrphanInsert } from "@shared/schema";
import { useSession } from "@/hooks/use-session";
import { getMilestonesQueryKey } from "@/hooks/use-milestones";

type MilestoneUpdate = MilestoneOrphanInsert & {
  id: Milestone["id"];
};

export const useMilestoneUpdate = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation<Milestone, Error, MilestoneUpdate>({
    mutationFn: (data) => apiRequest("PATCH", `/api/milestones/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getMilestonesQueryKey(user?.account.id),
      });
      toast({
        title: "Success",
        description: "Milestone updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update milestone: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};
