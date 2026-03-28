import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Milestone } from "@shared/schema";
import { useSession } from "@/hooks/use-session";
import { getMilestonesQueryKey } from "@/hooks/use-milestones";

export const useMilestoneDelete = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation<void, Error, Milestone["id"]>({
    mutationFn: (id) => apiRequest("DELETE", `/api/milestones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getMilestonesQueryKey(user?.account.id),
      });
      toast({
        title: "Milestone deleted",
        description: "Your investment milestone has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting milestone",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
