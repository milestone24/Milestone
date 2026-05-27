import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "@/context/SessionContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ResponsiveLayout from "@/components/layout/ResponsiveLayout";
import NotFound from "@/pages/not-found";
import { lazy, Suspense, useEffect } from "react";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/registerPage";
import { SavingsLoader } from "@/components/loaders/SavingsLoader";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ErrorBoundary } from "react-error-boundary";
import { useSocket } from "./hooks/use-socket";
import { useSession } from "./hooks/use-session";
import { brokerPlatformsQueryKey, brokerPlatformsQueryFn } from "./hooks/use-broker-platforms";
import { RecordTransactionProvider } from "@/context/RecordTransactionContext";
import { RecordTransactionDialog } from "@/components/record/RecordTransactionDialog";

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
const Documents = lazy(() => import("@/pages/documents"));
const OcrJobs = lazy(() => import("@/pages/ocr-jobs"));
const OcrJobDetail = lazy(() => import("@/pages/ocr-job-detail"));

function RouteWithLayout({
  component: Component,
  ...rest
}: {
  component: React.ComponentType;
}) {
  return (
    <ResponsiveLayout>
      <Suspense fallback={<SavingsLoader />}>
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
          <Route path="/documents">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={Documents} />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/ocr-jobs/:id">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={OcrJobDetail} />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/ocr-jobs">
            {() => (
              <ProtectedRoute>
                <RouteWithLayout component={OcrJobs} />
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
          <Route>{() => <RouteWithLayout component={NotFound} />}</Route>
        </Switch>
      </WouterRouter>
    </ErrorBoundary>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <SavingsLoader size="lg" />
    </div>
  );
}

function StaticDataPrefetch() {
  const { isAuthenticated } = useSession();

  useEffect(() => {
    if (!isAuthenticated) return;
    queryClient.prefetchQuery({
      queryKey: brokerPlatformsQueryKey,
      queryFn: brokerPlatformsQueryFn,
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
          <RecordTransactionProvider>
            <StaticDataPrefetch />
            <Router />
            <RecordTransactionDialog />
            <Toaster />
          </RecordTransactionProvider>
        </SessionProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
