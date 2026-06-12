#!/usr/bin/env node
/**
 * Copies client hooks into js-common with import repointing.
 * Run from repo root.
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const srcDir = path.join(repoRoot, "client/src/hooks");
const destDir = path.join(repoRoot, "packages/js-common/src/react/hooks");

const leaveInClient = new Set([
  "use-theme-colors.ts",
  "use-element-in-view.ts",
  "use-chart-dimensions.ts",
  "use-d3-render.ts",
  "use-fire-chart-render.ts",
  "use-track-chart-render.ts",
  "use-toast.ts",
  "use-fire.ts",
  "useAssetChartData.ts",
  "use-chart-interactions.ts",
  "use-fire-hero-chart.ts",
  "use-mobile.tsx",
]);

const replacements = [
  [/from "@shared\/schema\/"/g, 'from "../../schema"'],
  [/from "@shared\/schema\/document"/g, 'from "../../schema/document"'],
  [/from "@shared\/schema\/projections"/g, 'from "../../schema/projections"'],
  [/from "@shared\/schema\/portfolio-assets"/g, 'from "../../schema/portfolio-assets"'],
  [/from "@shared\/schema\/portfolio-fire"/g, 'from "../../schema/portfolio-fire"'],
  [/from "@shared\/schema\/user-account"/g, 'from "../../schema/user-account"'],
  [/from "@shared\/schema\/transaction"/g, 'from "../../schema/transaction"'],
  [/from "@shared\/schema\/email-ingest"/g, 'from "../../schema/email-ingest"'],
  [/from "@shared\/schema\/decimal-value"/g, 'from "../../schema/decimal-value"'],
  [/from "@shared\/schema\/socket"/g, 'from "../../schema/socket"'],
  [/from "@shared\/schema"/g, 'from "../../schema"'],
  [/from "shared\/schema"/g, 'from "../../schema"'],
  [/from "@shared\/api\/queryKeys"/g, 'from "../../api/queryKeys"'],
  [/from "@shared\/utils\/([^"]+)"/g, 'from "../../utils/$1"'],
  [/from "@\/lib\/queryClient"/g, 'from "../../api/transport"'],
  [/from "@\/lib\/date"/g, 'from "../../utils/date"'],
  [/from "@\/lib\/user"/g, 'from "../../utils/user"'],
  [/from "@\/lib\/ocr-inline-job-awaiting"/g, 'from "../../utils/ocr-inline-job-awaiting"'],
  [/from "@\/hooks\/use-toast"/g, 'from "../notifications/useNotifications"'],
  [/from "\.\/use-toast"/g, 'from "../notifications/useNotifications"'],
  [/from "@\/hooks\/use-session"/g, 'from "./use-session"'],
  [/from "@\/hooks\/use-milestones"/g, 'from "./use-milestones"'],
  [/from "@\/context\/SessionContext"/g, 'from "../context/SessionContext"'],
  [/from "\.\.\/context\/SessionContext"/g, 'from "../context/SessionContext"'],
  [/from "@server\/db\/schema"/g, 'from "@milestone/data/schema"'],
  [/import { useLocation } from "wouter";?\n/g, ""],
  [/from "\.\.\/capacitor"/g, 'from "../../platform/PlatformServicesProvider"'],
  [/window\.setTimeout/g, "setTimeout"],
  [/window\.clearTimeout/g, "clearTimeout"],
  [/import { apiRequest } from "\.\.\/\.\.\/api\/transport";/g,
    'import { apiRequest } from "../../api/transport";'],
];

function transform(content, filename) {
  let result = content;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  if (filename === "use-socket.ts") {
    result = result.replace(
      'import { apiRequest } from "../../api/transport";',
      'import { getSharedQueryClient } from "../../api/globalQueryClient";\nimport { useSocketUrl } from "../../platform/PlatformServicesProvider";\nimport { useNotificationService } from "../../platform/PlatformServicesProvider";'
    );
    result = result.replace(
      'import { queryClient } from "../../api/transport";',
      ""
    );
    result = result.replace(
      /const protocol = window\.location\.protocol === "https:" \? "wss" : "ws";\s*const websocketUrl = `\$\{protocol\}:\/\/\$\{window\.location\.host\}\/`;/,
      "const websocketUrl = socketUrl.getWebSocketUrl();"
    );
    result = result.replace(
      'export const useSocket = () => {\n  useEffect(() => {',
      "export const useSocket = () => {\n  const socketUrl = useSocketUrl();\n  const notifications = useNotificationService();\n  const queryClient = getSharedQueryClient();\n\n  useEffect(() => {"
    );
    result = result.replace(/\btoast\(/g, "notifications.show(");
    result = result.replace("  }, [queryClient]);", "  }, [notifications, queryClient, socketUrl]);");
  }

  if (filename === "use-ocr-job-events.ts") {
    result = result.replace(
      /const protocol = window\.location\.protocol === "https:" \? "wss" : "ws";\s*const ws = new WebSocket\(`\$\{protocol\}:\/\/\$\{window\.location\.host\}\/`\);/,
      "const ws = new WebSocket(socketUrl.getWebSocketUrl());"
    );
  }

  if (filename === "use-session.ts") {
    result = result.replace(
      'import { toast } from "../notifications/useNotifications";',
      'import { useNotifications } from "../notifications/useNotifications";\nimport { useNavigation, useStorage } from "../../platform/PlatformServicesProvider";\nimport { persistProfileImage, useSessionDispatch, useSessionState } from "../context/SessionContext";'
    );
    result = result.replace(
      'import { useSessionState, useSessionDispatch } from "../context/SessionContext";',
      ""
    );
    result = result.replace(
      "export function useSession() {\n  const queryClient = useQueryClient();\n  const [, setLocation] = useLocation();",
      "export function useSession() {\n  const queryClient = useQueryClient();\n  const navigation = useNavigation();\n  const storage = useStorage();\n  const { notify } = useNotifications();"
    );
    result = result.replace(
      /localStorage\.setItem\("profileImage", image\);\s*\} else \{\s*localStorage\.removeItem\("profileImage"\);\s*\}/,
      "await persistProfileImage(storage, image);"
    );
    result = result.replace(
      "const setProfileImage = (image: string | null) => {",
      "const setProfileImage = async (image: string | null) => {"
    );
    result = result.replace(/\btoast\(/g, "notify(");
    result = result.replace("setLocation(\"/login\");", 'navigation.navigate("/login");');
  }

  if (filename === "use-fire-preferences.ts") {
    result = result.replace(
      'import { GrowthRateScenario } from "./use-fire";',
      'import type { GrowthRateScenario } from "../types/fire-preferences";'
    );
    result = result.replace(
      /const getWindow = \(\) => \(typeof window === "undefined" \? null : window\);[\s\S]*?const readChartVisibility[\s\S]*?};/,
      ""
    );
    result = result.replace(
      "export function useFirePreferences() {",
      'import { useStorage } from "../../platform/PlatformServicesProvider";\n\nexport function useFirePreferences() {\n  const storage = useStorage();'
    );
    result = result.replace(
      /useState<GrowthRateScenario>\(\(\) => readGrowthRateScenario\(\)\)/,
      "useState<GrowthRateScenario>(DEFAULT_GROWTH_RATE_SCENARIO)"
    );
    result = result.replace(
      /useState<boolean>\(\(\) => readChartVisibility\(\)\)/,
      "useState<boolean>(false)"
    );
    result = result.replace(
      /useEffect\(\(\) => \{\s*const win = getWindow\(\);\s*if \(!win\) return;\s*win\.localStorage\.setItem\(GROWTH_RATE_SCENARIO_KEY, JSON\.stringify\(growthRateScenario\)\);\s*\}, \[growthRateScenario\]\);/,
      `useEffect(() => {
    void storage.setItem(GROWTH_RATE_SCENARIO_KEY, JSON.stringify(growthRateScenario));
  }, [growthRateScenario, storage]);`
    );
    result = result.replace(
      /useEffect\(\(\) => \{\s*const win = getWindow\(\);\s*if \(!win\) return;\s*win\.localStorage\.setItem\(CHART_VISIBLE_KEY, String\(showChart\)\);\s*\}, \[showChart\]\);/,
      `useEffect(() => {
    void storage.setItem(CHART_VISIBLE_KEY, String(showChart));
  }, [showChart, storage]);`
    );
    result = result.replace(
      "export type FireGrowthMode = GrowthMode;",
      'export type { FireGrowthMode, GrowthRateScenario } from "../types/fire-preferences";'
    );
  }

  if (filename === "use-standalone-contributors.ts") {
    result = result.replace(
      /const getWindow = \(\) => \(typeof window === "undefined" \? null : window\);[\s\S]*?function writeContributors[\s\S]*?}\n\n/,
      ""
    );
    result = result.replace(
      "export function useStandaloneContributors",
      'import { useStorage } from "../../platform/PlatformServicesProvider";\n\nexport function useStandaloneContributors'
    );
  }

  if (filename === "use-mobile-platform.ts") {
    result = result.replace(
      /import { isNativePlatform } from '\.\.\/capacitor';\s*[\s\S]*?export function useMobilePlatform\(\) \{[\s\S]*?return isMobilePlatform;\s*\}/,
      `import { usePlatformDetection } from "../../platform/PlatformServicesProvider";

export function useMobilePlatform() {
  const platformDetection = usePlatformDetection();
  return platformDetection.isNativePlatform();
}`
    );
  }

  if (filename === "use-mobile.ts") {
    result = result.replace(
      /[\s\S]*/,
      `import { useEffect, useState } from "react";
import { useViewport } from "../../platform/PlatformServicesProvider";

export function useMobile(breakpoint = 768) {
  const viewport = useViewport();
  const [isMobile, setIsMobile] = useState(() => viewport.getIsMobile());

  useEffect(() => {
    return viewport.subscribe(setIsMobile);
  }, [viewport]);

  return isMobile;
}
`
    );
  }

  if (filename === "use-document-upload.ts") {
    result = result.replace(
      /async function uploadDocument[\s\S]*?\}\n\n/,
      ""
    );
    result = result.replace(
      "export const useDocumentUpload = (config: OcrUploadConfig) => {",
      `import { useFileUploadTransport } from "../../platform/PlatformServicesProvider";

export const useDocumentUpload = (config: OcrUploadConfig) => {
  const fileUpload = useFileUploadTransport();`
    );
    result = result.replace(
      "mutationFn: (file) => uploadDocument(file, config),",
      `mutationFn: (file) => {
      const path =
        config.nominatedAssetId !== undefined && config.nominatedAssetId !== ""
          ? \`/api/assets/\${config.nominatedAssetId}/documents/\${encodeURIComponent(config.platformKey)}/extract\`
          : \`/api/documents/\${encodeURIComponent(config.platformKey)}/extract\`;
      return fileUpload.upload(path, file, {
        platformNames: JSON.stringify(config.platformNames),
      }) as Promise<DocumentOcrResponse>;
    },`
    );
  }

  // Replace toast / useToast patterns in mutation hooks
  result = result.replace(/\buseToast\(\)/g, "useNotifications()");
  result = result.replace(/const \{ toast \} = useNotifications\(\)/g, "const { notify } = useNotifications()");
  result = result.replace(/\btoast\(/g, "notify(");

  // Fix chart dimension imports in scale hooks
  result = result.replace(
    'from "./use-chart-dimensions"',
    'from "../chart/types"'
  );
  result = result.replace(
    "import type { ChartDimensions } from \"../chart/types\";",
    'import type { ChartDimensions } from "../chart/types";'
  );

  return result;
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

for (const file of fs.readdirSync(srcDir)) {
  if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
  if (leaveInClient.has(file)) continue;

  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file.replace(".tsx", ".ts"));
  const content = transform(fs.readFileSync(src, "utf8"), file);
  fs.writeFileSync(dest, content);
}

console.log("Hook migration complete.");
