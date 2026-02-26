import { useLocation, Link } from "wouter";
import {
  BarChart3,
  LineChart,
  Flag,
  Flame,
  CircleFadingPlus,
} from "lucide-react";
import { triggerHapticFeedback } from "../../capacitor";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobilePlatform } from "@/hooks/use-mobile-platform";

type NavItem = {
  id: string;
  path: string;
  label: string;
  icon: React.ReactNode;
};

export default function MobileBottomNav() {
  const [location] = useLocation();
  const isMobileViewport = useIsMobile();
  const isMobilePlatform = useMobilePlatform();

  // Only render on mobile viewports or native mobile platforms
  if (!isMobileViewport && !isMobilePlatform) {
    return null;
  }

  // Testing with a duplicated Track menu item instead of Goals
  const navItems: NavItem[] = [
    {
      id: "portfolio",
      path: "/portfolio",
      label: "Portfolio",
      icon: <BarChart3 size={20} />,
    },
    {
      id: "fire",
      path: "/fire",
      label: "FIRE",
      icon: <Flame size={20} />,
    },
    {
      id: "record",
      path: "/record",
      label: "Record",
      icon: <CircleFadingPlus size={20} />,
    },
    {
      id: "track",
      path: "/track",
      label: "Track",
      icon: <LineChart size={20} />,
    },
    {
      id: "goals",
      path: "/goals",
      label: "Goals",
      icon: <Flag size={20} />,
    },
  ];

  // Handle navigation with haptic feedback
  const handleNavClick = () => {
    triggerHapticFeedback();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-2xl">
      <table className="w-full h-14 table-fixed">
        <tbody>
          <tr>
            {navItems.map((item) => {
              const isActive = location === item.path;

              return (
                <td key={item.id} className="p-0 text-center">
                  <Link
                    href={item.path}
                    onClick={handleNavClick}
                    className="flex flex-col items-center justify-center h-full w-full"
                  >
                    <div className="h-6 flex items-center justify-center">
                      <div
                        className={`transition-colors ${
                          isActive
                            ? "text-[#0061ff]"
                            : "text-foreground hover:text-nav-active"
                        }`}
                      >
                        {item.icon}
                      </div>
                    </div>
                    <div className="h-4 flex items-center justify-center">
                      <span
                        className={`text-xs ${
                          isActive
                            ? "text-[#0061ff] font-medium"
                            : "text-foreground hover:text-nav-active"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  </Link>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
