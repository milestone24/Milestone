import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FireSettings } from "@shared/schema";
import { fireSettings } from "@shared/api/queryKeys";

export const useFireSettings = () =>
  useQuery<FireSettings>({
    queryKey: [...fireSettings],
    queryFn: async () => apiRequest("GET", "/api/fire-settings"),
  });
