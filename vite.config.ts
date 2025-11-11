import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
        type: "module",
      },
      includeAssets: [
        "icons/favicon.ico",
        "icons/apple-touch-icon.png",
        "icons/masked-icon.svg",
      ],
      workbox: {
        // Don't cache API routes
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Skip waiting for service worker updates
        skipWaiting: true,
        // Clean up old caches
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "Milestone",
        short_name: "Milestone",
        description: "Milestone Application",
        theme_color: "#ffffff",
        icons: [
          {
            src: "icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer()
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@server": path.resolve(__dirname, "server"),
    },
  },
  root: path.resolve(__dirname, "client"),

  server: {
    middlewareMode: false,
    fs: {
      strict: true,
      allow: [".."],
    },
    headers: {
      "Cache-Control": "public, max-age=31536000",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer-when-downgrade",
    },
    allowedHosts: true,
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "";
          const extType = name.split(".")[1] || "asset";
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/img/[name][extname]`;
          }
          return `assets/${extType}/[name][extname]`;
        },
      },
    },
  },
  publicDir: "public",
  assetsInclude: ["**/*.png", "**/*.svg", "**/*.ico", "**/*.webp"],
});
