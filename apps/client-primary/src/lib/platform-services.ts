import type { PlatformServices } from "@milestone/js-common/platform/types";
import { toast } from "@/hooks/use-toast";

const MOBILE_BREAKPOINT = 768;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export const webPlatformServices: PlatformServices = {
  storage: {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => {
      localStorage.setItem(key, value);
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
    },
  },
  navigation: {
    navigate: (path) => {
      window.location.assign(path);
    },
  },
  viewport: {
    getIsMobile: () => window.innerWidth < MOBILE_BREAKPOINT,
    subscribe: (callback) => {
      const onResize = () => callback(window.innerWidth < MOBILE_BREAKPOINT);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    },
  },
  platformDetection: {
    isNativePlatform: () => false,
  },
  socketUrl: {
    getWebSocketUrl: () => {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      return `${protocol}://${window.location.host}/`;
    },
  },
  fileUpload: {
    upload: async (path, file, fields) => {
      const formData = new FormData();
      if (file instanceof File) {
        formData.append("file", file);
      } else {
        const blob = await fetch(file.uri).then((response) => response.blob());
        formData.append("file", blob, file.name);
      }

      for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value);
      }

      const res = await fetch(path, {
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
      toast({
        title,
        description,
        variant,
      });
    },
  },
  colorScheme: {
    getSystemScheme: () =>
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
    subscribe: (callback) => {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        callback(mediaQuery.matches ? "dark" : "light");
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    },
  },
  themeApplication: {
    apply: (resolved) => {
      document.documentElement.classList.toggle("dark", resolved === "dark");
    },
  },
};
