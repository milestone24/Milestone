export type NotificationVariant = "default" | "destructive";

export interface NotificationOptions {
  title?: string;
  description?: string;
  variant?: NotificationVariant;
}

export interface NotificationService {
  show(options: NotificationOptions): void;
}

export interface KeyValueStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface NavigationService {
  navigate(path: string): void;
}

export interface ViewportService {
  subscribe(callback: (isMobile: boolean) => void): () => void;
  getIsMobile(): boolean;
}

export interface PlatformDetectionService {
  isNativePlatform(): boolean;
}

export interface SocketUrlService {
  getWebSocketUrl(): string;
}

export interface UploadFilePayload {
  uri: string;
  name: string;
  type: string;
}

export interface FileUploadTransport {
  upload(
    path: string,
    file: UploadFilePayload | File,
    fields: Record<string, string>
  ): Promise<unknown>;
}

export type ResolvedTheme = "light" | "dark";

export interface ColorSchemeService {
  getSystemScheme(): ResolvedTheme;
  subscribe(callback: (scheme: ResolvedTheme) => void): () => void;
}

export interface ThemeApplicationService {
  apply(resolved: ResolvedTheme): void;
}

export interface PlatformServices {
  storage: KeyValueStorage;
  navigation: NavigationService;
  viewport: ViewportService;
  platformDetection: PlatformDetectionService;
  socketUrl: SocketUrlService;
  fileUpload: FileUploadTransport;
  notifications: NotificationService;
  colorScheme: ColorSchemeService;
  themeApplication: ThemeApplicationService;
}
