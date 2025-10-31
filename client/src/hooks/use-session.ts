import { useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toast } from "./use-toast";
import { useSessionState, useSessionDispatch } from "../context/SessionContext";
import { SessionUser } from "@shared/schema/";
import { apiRequest } from "@/lib/queryClient";

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData extends LoginData {
  fullName: string;
}

// Custom error class for authentication errors
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export type SessionResponse = {
  user: SessionUser;
  message: string;
};

export function useSession() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // Use auth context state and dispatch
  const sessionState = useSessionState();
  const dispatch = useSessionDispatch();
  
  const setProfileImage = (image: string | null) => {
    if (image) {
      localStorage.setItem('profileImage', image);
    } else {
      localStorage.removeItem('profileImage');
    }
    dispatch({ type: "UPDATE_PROFILE_IMAGE", payload: image });
  };

  const { user, isLoginLoading: isLoginPending, isInitialUserLoading, isInitialUserLoadFailed, error, isAuthenticated } = sessionState;

  useQuery<SessionResponse | null>({
    queryKey: ["user"],
    queryFn: async () => {
      // Dispatch initial user loading action
      dispatch({ type: "INITIAL_USER_LOADING" });

      try {
        const responseData = await apiRequest<SessionResponse>(
          "GET",
          "/api/auth/me"
        );

        queryClient.setQueryData(["user"], responseData.user);
        dispatch({ type: "INITIAL_USER_LOADED", payload: responseData.user });

        //console.log("Initial user load successful:", responseData.user);

        return responseData;
      } catch (error) {

        console.log("Initial user load failed:", error);
        // For other errors, also mark as failed
        dispatch({ type: "INITIAL_USER_LOAD_FAILED" });
        throw error;
      }
    },

    // Don't retry on auth errors
    // retry: (failureCount, error) => {
    //   if (error instanceof Error && error.message === "Not authenticated") {
    //     return false;
    //   }
    //   return failureCount < 3;
    // },
    // Only refetch on window focus if we have a user
    refetchOnWindowFocus: (query) => !!query.state.data,
    // Longer stale time since we manage updates manually
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: isInitialUserLoadFailed === false,

  });

  // Extract user and loading state from auth context

  const { mutate: login } = useMutation<SessionResponse, Error, LoginData>({
    mutationFn: async (data: LoginData) => {
      console.log("Attempting login...");
      dispatch({ type: "LOGIN_LOADING" });
      
      const responseData = await apiRequest<SessionResponse>("POST", "/api/auth/login", data);
      console.log("Login successful, cookies should be set");
      return responseData;
    },
    onSuccess: (data) => {
      // Update both query cache and auth context
      queryClient.setQueryData(["user"], data.user);
      dispatch({ type: "AUTH_SUCCESS", payload: data.user });
      
      toast({
        title: "Welcome back!",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      // Update auth context with error
      dispatch({ 
        type: "AUTH_ERROR", 
        payload: error instanceof Error ? error : new Error("Login failed") 
      });
      
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { mutate: register, isPending: isRegisterPending } = useMutation({
    mutationFn: async (data: RegisterData) => {
      dispatch({ type: "LOGIN_LOADING" });
      
      const responseData = await apiRequest<SessionResponse>("POST", "/api/auth/register", data);

      return responseData;
    },
    onSuccess: (data) => {
      // Update both query cache and auth context
      queryClient.setQueryData(["user"], data.user);
      dispatch({ type: "AUTH_SUCCESS", payload: data.user });
      
      toast({
        title: "Welcome to Fifo Life!",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      // Update auth context with error
      dispatch({ 
        type: "AUTH_ERROR", 
        payload: error instanceof Error ? error : new Error("Registration failed") 
      });
      
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { mutate: logout, isPending: isLogoutPending } = useMutation({
    mutationFn: async () => {
      dispatch({ type: "LOGIN_LOADING" });
      dispatch({ type: "INITIAL_USER_LOADING" });
      
      const responseData = await apiRequest("POST", "/api/auth/logout");

      return responseData;
    },
    onSuccess: () => {
      // Update both query cache and auth context
      queryClient.setQueryData(["user"], null);
      dispatch({ type: "AUTH_LOGOUT" });
      
      setLocation("/login");
      toast({
        title: "Goodbye!",
        description: "You have been logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      
      const responseData = await apiRequest<SessionResponse>("POST", "/api/resend-verification", data);

      return responseData;
    },
    onSuccess: (data) => {
      // Update both query cache and auth context
      queryClient.setQueryData(["user"], data.user);
      dispatch({ type: "AUTH_SUCCESS", payload: data.user });
      
      toast({
        title: "Verification email sent",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      // Update auth context with error
      dispatch({ 
        type: "AUTH_ERROR", 
        payload: error instanceof Error ? error : new Error("Failed to resend verification email") 
      });
      
      toast({
        title: "Failed to resend verification email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Password reset request mutation
  const requestPasswordResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const responseData = await apiRequest<SessionResponse>("POST", "/api/forgot-password", { email });
      return responseData;
    },
    onSuccess: (data) => {
      toast({
        title: "Password Reset Email Sent",
        description: data.message || "If your email is registered, you will receive password reset instructions.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password Reset Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Validate reset token mutation
  const validateResetTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const responseData = await apiRequest<SessionResponse>("GET", `/api/validate-reset-token?token=${encodeURIComponent(token)}`);

      return responseData;
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const responseData = await apiRequest<SessionResponse>("POST", "/api/reset-password", { token, password });

      return responseData;
    },
    onSuccess: (data) => {
      toast({
        title: "Password Reset Successful",
        description: data.message || "Your password has been reset successfully. You can now log in with your new password.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isSessionPending = isLoginPending || isInitialUserLoading || isRegisterPending;

  return {
    // Return auth state from context and query
    user,
    isLoginPending,
    isRegisterPending,
    isSessionPending,
    isInitialUserLoading, // Expose the initial user loading state from the query
    isInitialUserLoadFailed, // Expose the new state
    error,
    isAuthenticated,
    profileImage: sessionState.profileImage,
    setProfileImage,
    
    login,
    register,
    logout,
    resendVerification: (email: string | { email: string }) => {
      // Handle both string and object with email property
      const emailData = typeof email === 'string' ? { email } : email;
      resendVerificationMutation.mutate(emailData);
    },
    
    // Password reset methods
    requestPasswordReset: async (email: string) => {
      try {
        await requestPasswordResetMutation.mutateAsync(email);
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Failed to request password reset" };
      }
    },
    validateResetToken: async (token: string) => {
      try {
        const result = await validateResetTokenMutation.mutateAsync(token);
        return { ok: true, email: result.user.account.email };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Invalid or expired token" };
      }
    },
    resetPassword: async (token: string, password: string) => {
      try {
        await resetPasswordMutation.mutateAsync({ token, password });
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Failed to reset password" };
      }
    },
  };
}
