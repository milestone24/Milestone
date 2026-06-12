import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Appearance,
  Dimensions,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { colorScheme as nativeWindColorScheme } from "nativewind";
import type { PlatformServices } from "@milestone/js-common/platform/types";
import { getApiBaseUrl } from "@/lib/api";
import { showToast } from "@/components/ui/toast";

const MOBILE_BREAKPOINT = 768;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export const nativePlatformServices: PlatformServices = {
  storage: {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  },
  navigation: {
    navigate: (path) => {
      if (path.startsWith("/login")) {
        router.replace("/(auth)/login");
        return;
      }
      if (path.startsWith("/register")) {
        router.replace("/(auth)/register");
        return;
      }
      if (path.startsWith("/portfolio") || path === "/") {
        router.replace("/(app)/(tabs)/portfolio");
        return;
      }
      router.replace(path as never);
    },
  },
  viewport: {
    getIsMobile: () => Dimensions.get("window").width < MOBILE_BREAKPOINT,
    subscribe: (callback) => {
      const subscription = Dimensions.addEventListener("change", ({ window }) => {
        callback(window.width < MOBILE_BREAKPOINT);
      });
      return () => subscription.remove();
    },
  },
  platformDetection: {
    isNativePlatform: () => Platform.OS !== "web",
  },
  socketUrl: {
    getWebSocketUrl: () => {
      const baseUrl = getApiBaseUrl();
      const url = new URL(baseUrl);
      const protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${url.host}/`;
    },
  },
  fileUpload: {
    upload: async (path, file, fields) => {
      const formData = new FormData();
      if (file instanceof File) {
        formData.append("file", file);
      } else {
        formData.append("file", {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as unknown as Blob);
      }

      for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value);
      }

      const resolvedPath = path.startsWith("http")
        ? path
        : `${getApiBaseUrl()}${path}`;

      const res = await fetch(resolvedPath, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      await throwIfResNotOk(res);
      return res.json();
    },
  },
  notifications: {
    show: ({ title, description, variant }) => {
      showToast({
        title,
        description,
        variant,
      });
    },
  },
  colorScheme: {
    getSystemScheme: () =>
      Appearance.getColorScheme() === "dark" ? "dark" : "light",
    subscribe: (callback) => {
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        callback(colorScheme === "dark" ? "dark" : "light");
      });
      return () => subscription.remove();
    },
  },
  themeApplication: {
    apply: (resolved) => {
      nativeWindColorScheme.set(resolved);
    },
  },
};
