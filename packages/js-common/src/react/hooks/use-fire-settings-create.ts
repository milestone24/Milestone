import { apiRequest } from "../../api/transport";
import { fireSettings } from "../../api/queryKeys";
import { FireSettingsInsert } from "../../schema";
import { FireSettings } from "../../schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useCreateFireSettings = () => {
  const queryClient = useQueryClient();
  return useMutation<
    FireSettings,
    Error,
    Omit<FireSettingsInsert, "id" | "userAccountId">
  >({
    mutationFn: async (settings) => {
      return apiRequest("POST", "/api/fire-settings", settings);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...fireSettings] });
    },
  });
};
