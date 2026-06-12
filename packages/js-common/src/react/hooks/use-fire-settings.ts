import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/transport";
import { FireSettings, fireSettingsOrphanFormSchema, fireSettingsOrphanSchema } from "../../schema";
import { fireSettings } from "../../api/queryKeys";

const THIRTY_MINUTES = 30 * 60 * 1000;

export const useFireSettings = () =>
  useQuery<FireSettings>({
    queryKey: [...fireSettings],
    gcTime: THIRTY_MINUTES,
    queryFn: async () => {
      const response = await apiRequest<FireSettings>("GET", "/api/fire-settings")

      const validation = fireSettingsOrphanSchema.safeParse(response);

      if (!validation.success) {
        throw new Error("Invalid fire settings");
      }

      return validation.data as FireSettings;
    }
  });
