import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { useNotifications } from '../notifications/useNotifications';
import type {
  RecurringContribution,
  RecurringContributionOrphanInsert,
  RecurringContributionBulkInsert,
} from "../../schema";
import { recurringContributionSelectSchema } from "../../schema";

const RECURRING_CONTRIBUTIONS_QUERY_KEY = "recurring-contributions";

export const getRecurringContributionsQueryKey = (assetId: string) => [
  RECURRING_CONTRIBUTIONS_QUERY_KEY,
  assetId,
];

type UpdateVariables = RecurringContributionOrphanInsert & { contributionId: string };
type DeleteVariables = { contributionId: string };
type RollbackContext = { previous?: RecurringContribution[] };

function getList(
  queryClient: ReturnType<typeof useQueryClient>,
  assetId: string | undefined
) {
  return queryClient.getQueryData<RecurringContribution[]>(
    getRecurringContributionsQueryKey(assetId ?? "")
  );
}

function setList(
  queryClient: ReturnType<typeof useQueryClient>,
  assetId: string | undefined,
  list: RecurringContribution[]
) {
  queryClient.setQueryData(
    getRecurringContributionsQueryKey(assetId ?? ""),
    list
  );
}

async function cancelAndSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  assetId: string | undefined
): Promise<RollbackContext> {
  await queryClient.cancelQueries({
    queryKey: getRecurringContributionsQueryKey(assetId ?? ""),
  });
  return { previous: getList(queryClient, assetId) };
}

function rollback(
  queryClient: ReturnType<typeof useQueryClient>,
  assetId: string | undefined,
  context: RollbackContext | undefined
) {
  if (context?.previous) {
    setList(queryClient, assetId, context.previous);
  }
}

export function useRecurringContributions(assetId: string | undefined) {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  const query = useQuery<RecurringContribution[]>({
    queryKey: getRecurringContributionsQueryKey(assetId ?? ""),
    queryFn: async () => {
      const data = await apiRequest<RecurringContribution[]>(
        "GET",
        `/api/assets/${assetId}/recurring-contributions`
      );
      const result = recurringContributionSelectSchema.array().safeParse(data);
      if (!result.success) {
        throw new Error(`Invalid recurring contributions response: ${result.error.message}`);
      }
      return result.data;
    },
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
      notify({
        title: "Recurring contribution created",
        description: "Recurring contribution has been created successfully.",
      });
    },
    onError: (error) => {
      notify({
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
      const ctx = await cancelAndSnapshot(queryClient, assetId);
      if (ctx.previous) {
        setList(
          queryClient,
          assetId,
          ctx.previous.map((c) =>
            c.id === contributionId ? { ...c, ...data } : c
          )
        );
      }
      return ctx;
    },
    onError: (_error, _vars, context) => {
      rollback(queryClient, assetId, context);
      notify({
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
      notify({
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
      notify({
        title: "Recurring contribution deleted",
        description: "Recurring contribution has been deleted successfully.",
      });
    },
    onError: (error) => {
      notify({
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
      notify({
        title: "Recurring contributions created",
        description:
          "Distributed recurring contributions have been created successfully.",
      });
    },
    onError: (error) => {
      notify({
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
