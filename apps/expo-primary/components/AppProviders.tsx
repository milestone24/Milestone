import { QueryClientProvider } from "@tanstack/react-query";
import { PlatformServicesProvider } from "@milestone/js-common/platform/PlatformServicesProvider";
import { SessionProvider } from "@milestone/js-common/react/context/SessionContext";
import { ThemeProvider } from "@milestone/js-common/react/context/ThemeContext";
import { RecordTransactionProvider } from "@milestone/js-common/react/context/RecordTransactionContext";
import { queryClient } from "@/lib/api";
import { nativePlatformServices } from "@/lib/platform-services";
import { StaticDataPrefetch } from "@/components/StaticDataPrefetch";
import { SocketConnection } from "@/components/SocketConnection";
import { ToastHost } from "@/components/ui/toast";
import { RecordTransactionModal } from "@/components/record/RecordTransactionModal";

import type { ReactNode } from "react";

type ProviderChildren = Parameters<typeof RecordTransactionProvider>[0]["children"];

export function AppProviders({ children }: { children: ReactNode }) {
  const providerChildren = children as ProviderChildren;

  return (
    <PlatformServicesProvider services={nativePlatformServices}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <RecordTransactionProvider>
              <SocketConnection />
              <StaticDataPrefetch />
              {providerChildren}
              <RecordTransactionModal />
              <ToastHost />
            </RecordTransactionProvider>
          </SessionProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </PlatformServicesProvider>
  );
}
