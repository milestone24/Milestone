import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { PlatformServices } from "./types";

const PlatformServicesContext = createContext<PlatformServices | null>(null);

export function PlatformServicesProvider({
  services,
  children,
}: {
  services: PlatformServices;
  children: ReactNode;
}) {
  return (
    <PlatformServicesContext.Provider value={services}>
      {children}
    </PlatformServicesContext.Provider>
  );
}

export function usePlatformServices(): PlatformServices {
  const context = useContext(PlatformServicesContext);
  if (!context) {
    throw new Error(
      "usePlatformServices must be used within a PlatformServicesProvider"
    );
  }
  return context;
}

export function useStorage() {
  return usePlatformServices().storage;
}

export function useNavigation() {
  return usePlatformServices().navigation;
}

export function useViewport() {
  return usePlatformServices().viewport;
}

export function usePlatformDetection() {
  return usePlatformServices().platformDetection;
}

export function useSocketUrl() {
  return usePlatformServices().socketUrl;
}

export function useFileUploadTransport() {
  return usePlatformServices().fileUpload;
}

export function useNotificationService() {
  return usePlatformServices().notifications;
}

export function useColorScheme() {
  return usePlatformServices().colorScheme;
}

export function useThemeApplication() {
  return usePlatformServices().themeApplication;
}
