import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  RecurringContribution,
  RecurringContributionInsert,
  RecurringContributionOrphanInsert,
  RecurringContributionBulkInsert,
} from "@shared/schema";

const RECURRING_CONTRIBUTIONS_QUERY_KEY = "recurring-contributions";

export const getRecurringContributionsQueryKey = (assetId: string) => [
  RECURRING_CONTRIBUTIONS_QUERY_KEY,
  assetId,
];

export function useRecurringContributions(assetId: string | undefined) {
  const query = useQuery<RecurringContribution[]>({
    queryKey: getRecurringContributionsQueryKey(assetId ?? ""),
    queryFn: () =>
      apiRequest<RecurringContribution[]>(
        "GET",
        `/api/assets/${assetId}/recurring-contributions`
      ),
    enabled: !!assetId,
  });

  const createMutation = useMutation<
    RecurringContribution,
    Error,
    RecurringContributionOrphanInsert
  >({
    mutationFn: (data: RecurringContributionOrphanInsert) =>
      apiRequest<RecurringContribution>(
        "POST",
        `/api/assets/${assetId}/recurring-contributions`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRecurringContributionsQueryKey(assetId ?? ""),
      });
    },
  });

  const updateMutation = useMutation<
    RecurringContribution,
    Error,
    RecurringContributionOrphanInsert & { contributionId: string }
  >({
    mutationFn: ({
      contributionId,
      ...data
    }: RecurringContributionOrphanInsert & { contributionId: string }) =>
      apiRequest<RecurringContribution>(
        "PUT",
        `/api/assets/${assetId}/recurring-contributions/${contributionId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRecurringContributionsQueryKey(assetId ?? ""),
      });
    },
  });

  const deleteMutation = useMutation<
    { success: boolean },
    Error,
    { contributionId: string }
  >({
    mutationFn: ({ contributionId }: { contributionId: string }) =>
      apiRequest<{ success: boolean }>(
        "DELETE",
        `/api/assets/${assetId}/recurring-contributions/${contributionId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRecurringContributionsQueryKey(assetId ?? ""),
      });
    },
  });

  // Bulk create distributed recurring contributions across multiple securities
  const createBulkMutation = useMutation<
    RecurringContribution[],
    Error,
    RecurringContributionBulkInsert
  >({
    mutationFn: (data: RecurringContributionBulkInsert) =>
      apiRequest<RecurringContribution[]>(
        "POST",
        `/api/assets/${assetId}/recurring-contributions/group`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRecurringContributionsQueryKey(assetId ?? ""),
      });
    },
  });

  return {
    recurringContributions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createRecurringContribution: createMutation,
    createRecurringContributionGroup: createBulkMutation,
    updateRecurringContribution: updateMutation,
    deleteRecurringContribution: deleteMutation,
  };
}

