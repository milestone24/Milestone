import Constants from "expo-constants";
import {
  configureApiTransport,
  defaultFetchApiRequest,
} from "@milestone/js-common/api/transport";
import { createQueryClient } from "@milestone/js-common/api/queryClient";
import { configureSharedQueryClient } from "@milestone/js-common/api/globalQueryClient";

export function getApiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  return extra?.apiUrl ?? "http://localhost:5000";
}

configureApiTransport({
  request: (method, url, data) =>
    defaultFetchApiRequest(method, url, data, {
      baseUrl: getApiBaseUrl(),
      credentials: "include",
    }),
});

export const queryClient = createQueryClient();
configureSharedQueryClient(queryClient);
