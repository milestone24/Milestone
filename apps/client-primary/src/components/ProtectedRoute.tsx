import { ReactNode, useCallback, useEffect } from "react";
import { SavingsLoader } from "@/components/loaders/SavingsLoader";
import { useLocation } from "wouter";
import { useSession } from "../hooks/use-session";

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { isInitialUserLoading, isAuthenticated } = useSession();
  const [, navigate] = useLocation();

  const path = window.location.pathname;

  const redirectUnAuth = useCallback(() => {
    if (!isAuthenticated) {
      navigate(`${redirectTo}?rt=${encodeURIComponent(path)}`);
    }
    // We only want the function to change if requireAuth or isAuthenticated changes
    //We do not want to change the the function for every render or if path changes.
  }, [isAuthenticated]);

  useEffect(() => {
    // For protected routes
    if (!isInitialUserLoading) {
      redirectUnAuth();
    }
  }, [isInitialUserLoading]);

  // Show loading state while checking authentication
  if (isInitialUserLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <SavingsLoader size="lg" />
      </div>
    );
  }
  
  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
