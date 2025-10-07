import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

type Process = {};

export const useProcess = (processId: string) => {
  const {
    data: process,
    isLoading,
    isError,
    error,
  } = useQuery<Process>({
    queryKey: ["process", processId],
    queryFn: () =>
      apiRequest<Process>("GET", `/api/tracking/processes/${processId}`),
  });

  return { process, isLoading, isError, error };
};
