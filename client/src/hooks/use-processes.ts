import { apiRequest } from "@/lib/queryClient";
import { ProcessStatus } from "@server/db/schema";
import { processes as processesKey } from "@shared/api/queryKeys";
import { ProcessSelect, processSelectSchema } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

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
  } = useQuery<ProcessSelect[]>({
    queryKey: [...processesKey, options?.filters],
    queryFn: async () => {
      const url = defineUrl(options);
      const data = await apiRequest<ProcessSelect[]>("GET", url);
      const result = processSelectSchema.array().safeParse(data);
      if (!result.success) {
        throw new Error(`Invalid processes response: ${result.error.message}`);
      }
      return result.data;
    },
  });

  return { processes, isLoading, isError, error };
};
