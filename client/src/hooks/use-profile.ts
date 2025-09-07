import { apiRequest } from "@/lib/queryClient";
import { useSession } from "./use-session";
import { useMutation } from "@tanstack/react-query";
import { UpdateProfileOrphanInput } from "@shared/schema/user-account";

export const useProfile = () => {
  const { user } = useSession();

  const updateProfile = useMutation({
    mutationFn: (profile: UpdateProfileOrphanInput) => {
      console.log("updateProfile profile", profile);
      return apiRequest("PATCH", "/api/users/profile", profile);
    },
  });

  return { updateProfile };
};
