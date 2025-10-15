import { apiRequest, queryClient } from "@/lib/queryClient";
import { fireSettings } from "@shared/api/queryKeys";
import { FireSettings, FireSettingsInsert } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";

export const usePatchFireSettings = () => {
  return useMutation<
    FireSettings,
    Error,
    Omit<FireSettingsInsert, "id" | "userAccountId">
  >({
    mutationFn: async (settings) => {
      return apiRequest("PATCH", "/api/fire-settings", settings);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...fireSettings] });
    },
  });
};
