import { ReactNode } from "react";
import { useMobilePlatform } from "@/hooks/use-mobile-platform";
import { useIsMobile } from "@/hooks/use-mobile";
import MainLayout from "./MainLayout";
import BottomNav from "./BottomNav";
import Header from "./Header";

interface ResponsiveLayoutProps {
  children: ReactNode;
}

/**
 * Responsive layout that handles different layouts for mobile and desktop
 * - Uses mobile-specific components with Capacitor integration on native platforms
 * - Uses desktop layout with sidebar on web browsers
 */
export default function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const isMobilePlatform = useMobilePlatform();
  const isMobileViewport = useIsMobile();

  // Determine if we should use the mobile layout
  const useMobileLayout = isMobilePlatform || isMobileViewport;

  // Render mobile layout for native mobile platforms or small viewports
  if (useMobileLayout) {
    return (
      <div className="flex flex-col min-h-screen relative">
        <Header />
        <main className="main-content p-2 md:p-4">{children}</main>
        <BottomNav />
      </div>
    );
  }

  // Render desktop layout for web browsers on larger viewports
  return <MainLayout>{children}</MainLayout>;
}
