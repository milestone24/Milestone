import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FireSettings, fireSettingsOrphanFormSchema, fireSettingsOrphanSchema } from "@shared/schema";
import { fireSettings } from "@shared/api/queryKeys";

export const useFireSettings = () =>
  useQuery<FireSettings>({
    queryKey: [...fireSettings],

    queryFn: async () => {
      const response = await apiRequest<FireSettings>("GET", "/api/fire-settings")

      const validation = fireSettingsOrphanSchema.safeParse(response);

      if (!validation.success) {
        throw new Error("Invalid fire settings");
      }

      return validation.data as FireSettings;
    }
  });
