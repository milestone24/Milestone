import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { PortfolioProvider } from "@/context/PortfolioContext";
import { SessionProvider } from "@/context/SessionContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ResponsiveLayout from "@/components/layout/ResponsiveLayout";
import NotFound from "@/pages/not-found";
import { lazy, Suspense, useEffect } from "react";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/registerPage";
import { Loader, Loader2 } from "lucide-react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ErrorBoundary } from "react-error-boundary";
import { useSocket } from "./hooks/use-socket";
import { useSession } from "./hooks/use-session";
import { brokerPlatformsQueryKey } from "./hooks/use-broker-platforms";
import { brokerProvidersQueryKey } from "./hooks/use-broker-providers";
import { apiRequest } from "./lib/queryClient";
import { BrokerPlatform, BrokerProvider } from "@shared/schema";

const Portfolio = lazy(() => import("@/pages/portfolio"));
const AssetPage = lazy(() => import("@/pages/asset"));
const Goals = lazy(() => import("@/pages/goals"));
const Track = lazy(() => import("@/pages/track"));
const FireNow = lazy(() => import("@/pages/fire-now"));
//TODO: Remove this route once we have migrated all users to the new FIRE calculator.
const FireLast = lazy(() => import("@/pages/fire-last"));
const Profile = lazy(() => import("@/pages/profile"));
const Settings = lazy(() => import("@/pages/settings"));
const ApiConnections = lazy(() => import("@/pages/api-connections"));
const NestedAssetPage = lazy(() => import("@/pages/asset-security"));
const Record = lazy(() => import("@/pages/record"));

function RouteWithLayout({
  component: Component,
  ...rest
}: {
  component: React.ComponentType;
}) {
  return (
    <ResponsiveLayout>
      <Suspense fallback={<Loader />}>
        <ErrorBoundary fallback={<p>⚠️Something went wrong</p>}>
          <Component {...rest} />
        </ErrorBoundary>
      </Suspense>
    </ResponsiveLayout>
  );
}

function Router() {
  return (
    <ErrorBoundary fallback={<p>⚠️Something went wrong</p>}>
      <WouterRouter>
        <Switch>
          {/* Auth Routes */}
          <Route path="/login">{() => <LoginPage />}</Route>
          <Route path="/register">{() => <RegisterPage />}</Route>

          {/* Protected Routes */}
          <Route path="/">
            <Redirect to="/portfolio" />
          </Route>
          <Route path="/portfolio">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={Portfolio} />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/goals">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={Goals} />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/track">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={Track} />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/record">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={Record} />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/fire">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={FireNow} />
              </ProtectedRoute>
            )}
          </Route>
          {/* Legacy route for now, to be removed later */}
          <Route path="/fire-last">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={FireLast} />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/profile">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={Profile} />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/settings">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={Settings} />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/api-connections">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={ApiConnections} />
              </ProtectedRoute>
            )}
          </Route>

          {/* Maybe later when more abstractesd use dynamic routes
        <Route path="/asset/broker/*">
          {() => (
            <ProtectedRoute>
              <RouteWithLayout component={BrokerAsset} />
            </ProtectedRoute>
          )}
        </Route>
        */}
          <Route path="/asset/:id">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={AssetPage} />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/asset/broker/:id/item/:nestedId">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={NestedAssetPage} />
              </ProtectedRoute>
            )}
          </Route>
          <Route>{() => <RouteWithLayout component={NotFound} />}</Route>
        </Switch>
      </WouterRouter>
    </ErrorBoundary>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground text-lg font-medium">Loading your data...</p>
    </div>
  );
}

function StaticDataPrefetch() {
  const { isAuthenticated } = useSession();

  useEffect(() => {
    if (!isAuthenticated) return;
    queryClient.prefetchQuery({
      queryKey: brokerPlatformsQueryKey,
      queryFn: () => apiRequest<BrokerPlatform[]>("GET", "/api/assets/broker-platforms"),
    });
    queryClient.prefetchQuery({
      queryKey: brokerProvidersQueryKey,
      queryFn: () => apiRequest<BrokerProvider[]>("GET", "/api/assets/broker-providers"),
    });
  }, [isAuthenticated]);

  return null;
}

function App() {
  useSocket();
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StaticDataPrefetch />
          <PortfolioProvider>
            <Router />
            <Toaster />
          </PortfolioProvider>
        </SessionProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
