import { useQuery, skipToken } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Milestone, milestoneSchema } from "@shared/schema";
import { getEndpointPathWithUserId } from "@/lib/user";
import { useSession } from "@/hooks/use-session";

export const getMilestonesQueryKey = (userId: string | undefined): string[] => {
  const id = userId ?? "none";
  return [getEndpointPathWithUserId("/api/milestones/user/{userId}", id), id];
};

export const useMilestones = () => {
  const { user, isSessionPending } = useSession();
  const apiEnabled = !isSessionPending && !!user;
  const queryKey = getMilestonesQueryKey(user?.account.id);

  const { data: milestones = [], isLoading, isError } = useQuery<Milestone[]>({
    queryKey,
    queryFn: apiEnabled
      ? async () => {
          const data = await apiRequest("GET", queryKey[0] ?? "");
          const result = milestoneSchema.array().safeParse(data);
          if (!result.success) {
            throw new Error(
              `Invalid milestones response: ${result.error.message}`
            );
          }
          return result.data;
        }
      : skipToken,
  });

  useEffect(() => {
    if (isError) {
      toast({
        title: "Failed to load milestones",
        description:
          "There was an error loading your investment milestones. Please try again.",
        variant: "destructive",
      });
    }
  }, [isError]);

  return { milestones, isLoading };
};
