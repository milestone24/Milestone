import {
  apiRequest as sharedApiRequest,
  configureApiTransport,
  defaultFetchApiRequest,
} from "@milestone/js-common/api/transport";
import { createQueryClient } from "@milestone/js-common/api/queryClient";
import { configureSharedQueryClient } from "@milestone/js-common/api/globalQueryClient";

configureApiTransport({
  request: (method, url, data) =>
    defaultFetchApiRequest(method, url, data, {
      baseUrl: import.meta.env.VITE_API_URL ?? "",
      credentials: "include",
    }),
});

export const queryClient = createQueryClient();
configureSharedQueryClient(queryClient);

export const apiRequest = sharedApiRequest;

