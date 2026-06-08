import type { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | null = null;

export function configureSharedQueryClient(client: QueryClient): void {
  queryClient = client;
}

export function getSharedQueryClient(): QueryClient {
  if (!queryClient) {
    throw new Error(
      "Shared QueryClient is not configured. Call configureSharedQueryClient during app bootstrap."
    );
  }
  return queryClient;
}
