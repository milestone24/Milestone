import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  emailIngestInboxDetailKey,
  emailIngestInboxes as emailIngestInboxesQueryKey,
} from "@shared/api/queryKeys";
import {
  emailIngestInboxCreateRequestSchema,
  emailIngestInboxResponseSchema,
  emailIngestInboxUpdateAllowedSendersRequestSchema,
  type EmailIngestInboxCreateRequest,
  type EmailIngestInboxResponse,
  type EmailIngestInboxUpdateAllowedSendersRequest,
} from "@shared/schema/email-ingest";

function parseListResponse(payload: unknown): EmailIngestInboxResponse[] {
  const parsed = emailIngestInboxResponseSchema.array().safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `Invalid email ingest inbox list: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

function parseOneResponse(payload: unknown): EmailIngestInboxResponse {
  const parsed = emailIngestInboxResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `Invalid email ingest inbox response: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function useEmailIngestInboxes(options?: {
  includeRevoked?: boolean;
}) {
  const includeRevoked = options?.includeRevoked ?? false;
  return useQuery<EmailIngestInboxResponse[]>({
    queryKey: [...emailIngestInboxesQueryKey, { includeRevoked }] as const,
    queryFn: async () => {
      const qs = includeRevoked ? "?includeRevoked=true" : "";
      const response = await apiRequest<unknown>(
        "GET",
        `/api/email-ingest-inboxes${qs}`,
      );
      return parseListResponse(response);
    },
  });
}

export function useEmailIngestInbox(inboxId: string | undefined) {
  return useQuery<EmailIngestInboxResponse>({
    queryKey: inboxId
      ? emailIngestInboxDetailKey(inboxId)
      : ([...emailIngestInboxesQueryKey, "disabled"] as const),
    enabled: Boolean(inboxId),
    queryFn: async () => {
      if (!inboxId) {
        throw new Error("inboxId is required");
      }
      const response = await apiRequest<unknown>(
        "GET",
        `/api/email-ingest-inboxes/${inboxId}`,
      );
      return parseOneResponse(response);
    },
  });
}

export function useCreateEmailIngestInbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: EmailIngestInboxCreateRequest) => {
      const parsedBody = emailIngestInboxCreateRequestSchema.parse(body);
      const response = await apiRequest<unknown>(
        "POST",
        "/api/email-ingest-inboxes",
        parsedBody,
      );
      return parseOneResponse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...emailIngestInboxesQueryKey],
      });
    },
  });
}

export function useUpdateEmailIngestInboxAllowedSenders(inboxId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: EmailIngestInboxUpdateAllowedSendersRequest) => {
      const parsedBody =
        emailIngestInboxUpdateAllowedSendersRequestSchema.parse(body);
      const response = await apiRequest<unknown>(
        "PATCH",
        `/api/email-ingest-inboxes/${inboxId}/allowed-senders`,
        parsedBody,
      );
      return parseOneResponse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...emailIngestInboxesQueryKey],
      });
      void queryClient.invalidateQueries({
        queryKey: emailIngestInboxDetailKey(inboxId),
      });
    },
  });
}

export function useRevokeEmailIngestInbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inboxId: string) => {
      const response = await apiRequest<unknown>(
        "POST",
        `/api/email-ingest-inboxes/${inboxId}/revoke`,
      );
      return parseOneResponse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...emailIngestInboxesQueryKey],
      });
    },
  });
}

export function useRegenerateEmailIngestInbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inboxId: string) => {
      const response = await apiRequest<unknown>(
        "POST",
        `/api/email-ingest-inboxes/${inboxId}/regenerate`,
      );
      return parseOneResponse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...emailIngestInboxesQueryKey],
      });
    },
  });
}
