import { apiRequest } from "@/lib/queryClient";
import { FireSettings, FireSettingsInsert } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";

export const usePatchFireSettings = () => {
  return useMutation<
    FireSettings,
    Error,
    Omit<FireSettingsInsert, "id" | "userAccountId">
  >({
    mutationFn: async (settings) => {
      return apiRequest("PATCH", "/api/fire-settings", { settings });
    },
  });
};
