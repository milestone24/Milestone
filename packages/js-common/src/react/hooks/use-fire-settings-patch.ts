import { apiRequest } from "../../api/transport";
import { fireSettings } from "../../api/queryKeys";
import { FireSettings, FireSettingsInsert } from "../../schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const usePatchFireSettings = () => {
  const queryClient = useQueryClient();
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
