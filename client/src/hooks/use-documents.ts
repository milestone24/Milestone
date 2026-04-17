import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { documents as documentsKey } from "@shared/api/queryKeys";
import { documentWithOcrSchema, type DocumentWithOcr } from "@shared/schema/document";

export const useDocuments = () => {
  const { data, isLoading, isError, error } = useQuery<DocumentWithOcr[]>({
    queryKey: documentsKey,
    queryFn: async () => {
      const response = await apiRequest<DocumentWithOcr[]>("GET", "/api/documents");
      const result = documentWithOcrSchema.array().safeParse(response);
      if (!result.success) {
        throw new Error(`Invalid documents response: ${result.error.message}`);
      }
      return result.data;
    },
  });

  return { documents: data, isLoading, isError, error };
};
