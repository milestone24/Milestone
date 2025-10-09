import { apiRequest } from "@/lib/queryClient";
import { ProcessStatus } from "@server/db/schema";
import { processes as processesKey } from "@shared/api/queryKeys";
import { useQuery } from "@tanstack/react-query";

type Process = {};

export type UserProcessOptions = {
  filters?: {
    status?: ProcessStatus[];
    keys?: string[];
  };
};

const defineUrl = (options?: UserProcessOptions) => {
  const url = "/api/tracking/processes";
  let params = "";
  if (options?.filters) {
    if (options.filters.status) {
      const statusParams = options.filters.status
        .map((status) => `status=${status}`)
        .join("&");
      params += `${statusParams}`;
    }
  }
  if (options?.filters?.keys) {
    const keysParams = options.filters.keys
      .map((key) => `key=${key}`)
      .join("&");
    params += params ? `&${keysParams}` : `${keysParams}`;
  }
  return url + (params ? `?${params}` : "");
};

export const useProcesses = (options?: UserProcessOptions) => {
  const {
    data: processes,
    isLoading,
    isError,
    error,
  } = useQuery<Process[]>({
    queryKey: [...processesKey, options?.filters],
    queryFn: () => {
      const url = defineUrl(options);
      console.log("url", url);
      return apiRequest<Process[]>("GET", url);
    },
  });

  return { processes, isLoading, isError, error };
};
