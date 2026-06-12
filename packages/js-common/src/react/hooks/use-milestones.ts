import { useQuery, skipToken } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiRequest } from "../../api/transport";
import { useNotifications } from '../notifications/useNotifications';
import { Milestone, milestoneSchema } from "../../schema";
import { getEndpointPathWithUserId } from "../../utils/user";
import { useSession } from "./use-session";

export const getMilestonesQueryKey = (userId: string | undefined): string[] => {
  const id = userId ?? "none";
  return [getEndpointPathWithUserId("/api/milestones/user/{userId}", id), id];
};

export const useMilestones = () => {
  const { notify } = useNotifications();
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
      notify({
        title: "Failed to load milestones",
        description:
          "There was an error loading your investment milestones. Please try again.",
        variant: "destructive",
      });
    }
  }, [isError]);

  return { milestones, isLoading };
};
