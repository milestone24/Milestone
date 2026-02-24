import {
  TrendingUp,
  Flag,
  LineChart,
  Flame,
  CircleFadingPlus,
  BarChart3,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { cn } from "@/lib/utils";
import { usePortfolio } from "@/context/PortfolioContext";
import { triggerHapticFeedback } from "@/capacitor";

type NavItem = {
  id: string;
  path: string;
  label: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  {
    id: "portfolio",
    path: "/portfolio",
    label: "Portfolio",
    icon: <BarChart3 size={20} />,
  },
  {
    id: "goals",
    path: "/goals",
    label: "Goals",
    icon: <Flag size={20} />,
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
    id: "fire",
    path: "/fire",
    label: "FIRE",
    icon: <Flame size={20} />,
  },
];

export default function BottomNav() {
  const [location, setLocation] = useLocation();
  // If props are not provided, get values from context
  const portfolio = usePortfolio();

  // Handle navigation with haptic feedback on mobile devices
  const handleNavigation = (item: NavItem) => {
    triggerHapticFeedback();
    setLocation(item.path);
  };

  return (
    <nav className="bg-background border-t border-border fixed bottom-0 w-full z-10">
      <div className="max-w-5xl mx-auto">
        <ul className="flex justify-between">
          {navItems.map((item) => {
            const [isActive] = useRoute(item.path);
            const isActiveHome = location === "/" && item.id === "portfolio";

            return (
              <li key={item.id} className="flex-1">
                <button
                  className={cn(
                    "nav-item flex flex-col items-center pt-2 pb-1 w-full",
                    item.id === "record"
                      ? isActive
                        ? "bg-nav-cta-bg-active text-white mx-1"
                        : "bg-nav-cta-bg text-white mx-1"
                      : isActive || isActiveHome
                      ? "text-nav-active"
                      : "text-muted-foreground"
                  )}
                  onClick={() => handleNavigation(item)}
                  aria-label={item.label}
                >
                  {item.icon}
                  <span className="text-xs">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
