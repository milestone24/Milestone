import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import type {
  RecurringContribution,
  RecurringContributionOrphanInsert,
  RecurringContributionBulkInsert,
} from "@shared/schema";

const RECURRING_CONTRIBUTIONS_QUERY_KEY = "recurring-contributions";

export const getRecurringContributionsQueryKey = (assetId: string) => [
  RECURRING_CONTRIBUTIONS_QUERY_KEY,
  assetId,
];

type UpdateVariables = RecurringContributionOrphanInsert & { contributionId: string };
type DeleteVariables = { contributionId: string };
type RollbackContext = { previous?: RecurringContribution[] };

function getList(assetId: string | undefined) {
  return queryClient.getQueryData<RecurringContribution[]>(
    getRecurringContributionsQueryKey(assetId ?? "")
  );
}

function setList(assetId: string | undefined, list: RecurringContribution[]) {
  queryClient.setQueryData(
    getRecurringContributionsQueryKey(assetId ?? ""),
    list
  );
}

async function cancelAndSnapshot(assetId: string | undefined): Promise<RollbackContext> {
  await queryClient.cancelQueries({
    queryKey: getRecurringContributionsQueryKey(assetId ?? ""),
  });
  return { previous: getList(assetId) };
}

function rollback(assetId: string | undefined, context: RollbackContext | undefined) {
  if (context?.previous) {
    setList(assetId, context.previous);
  }
}

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
      toast({
        title: "Recurring contribution created",
        description: "Recurring contribution has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating recurring contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation<
    RecurringContribution,
    Error,
    UpdateVariables,
    RollbackContext
  >({
    mutationFn: ({ contributionId, ...data }: UpdateVariables) =>
      apiRequest<RecurringContribution>(
        "PUT",
        `/api/assets/${assetId}/recurring-contributions/${contributionId}`,
        data
      ),
    onMutate: async ({ contributionId, ...data }) => {
      const ctx = await cancelAndSnapshot(assetId);
      if (ctx.previous) {
        setList(
          assetId,
          ctx.previous.map((c) =>
            c.id === contributionId ? { ...c, ...data } : c
          )
        );
      }
      return ctx;
    },
    onError: (_error, _vars, context) => {
      rollback(assetId, context);
      toast({
        title: "Error updating recurring contribution",
        description:
          _error instanceof Error ? _error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRecurringContributionsQueryKey(assetId ?? ""),
      });
      toast({
        title: "Recurring contribution updated",
        description: "Recurring contribution has been updated successfully.",
      });
    },
  });

  const deleteMutation = useMutation<
    { success: boolean },
    Error,
    DeleteVariables
  >({
    mutationFn: ({ contributionId }: DeleteVariables) =>
      apiRequest<{ success: boolean }>(
        "DELETE",
        `/api/assets/${assetId}/recurring-contributions/${contributionId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRecurringContributionsQueryKey(assetId ?? ""),
      });
      toast({
        title: "Recurring contribution deleted",
        description: "Recurring contribution has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting recurring contribution",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

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
      toast({
        title: "Recurring contributions created",
        description:
          "Distributed recurring contributions have been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating recurring contributions",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
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
