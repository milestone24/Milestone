import { apiRequest } from "@/lib/queryClient";
import { FireSettingsInsert } from "@shared/schema";
import { FireSettings } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";

export const useCreateFireSettings = () => {
  return useMutation<
    FireSettings,
    Error,
    Omit<FireSettingsInsert, "id" | "userAccountId">
  >({
    mutationFn: async (settings) => {
      return apiRequest("POST", "/api/fire-settings", { settings });
    },
  });
};
