import { LayoutGrid, Clock, Plus, Activity, Star } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { triggerHapticFeedback } from "@/capacitor";
import { useRecordTransaction } from "@/context/RecordTransactionContext";

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
    icon: <LayoutGrid size={24} />,
  },
  {
    id: "goals",
    path: "/goals",
    label: "Goals",
    icon: <Clock size={24} />,
  },
  {
    id: "record",
    path: "/record",
    label: "Record",
    icon: <Plus size={24} />,
  },
  {
    id: "track",
    path: "/track",
    label: "Track",
    icon: <Activity size={24} />,
  },
  {
    id: "fire",
    path: "/fire",
    label: "FIRE",
    icon: <Star size={24} />,
  },
];

function getActiveIndex(location: string): number {
  if (location === "/" || location.startsWith("/portfolio")) return 0;
  if (location.startsWith("/goals")) return 1;
  if (location.startsWith("/record")) return 2;
  if (location.startsWith("/track")) return 3;
  if (location.startsWith("/fire")) return 4;
  return 0;
}

export default function BottomNav() {
  const [location, setLocation] = useLocation();
  const activeIndex = getActiveIndex(location);
  const { openTransaction } = useRecordTransaction();

  const handleNavigation = (item: NavItem) => {
    triggerHapticFeedback();
    if (item.id === "record") {
      openTransaction();
    } else {
      setLocation(item.path);
    }
  };

  return (
    <nav
      className="fixed bottom-4 left-4 right-4 z-10 flex items-center rounded-full py-1.5 bg-card/90 backdrop-blur-xl border border-white/[0.08]"
      style={{
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
      }}
    >
      {/* Sliding liquid pill — tracks the active item */}
      <div
        className="absolute rounded-full pointer-events-none top-1.5 bottom-1.5 bg-primary/15 border border-primary/20"
        style={{
          width: "20%",
          left: `${activeIndex * 20}%`,
          transition:
            "left 0.4s cubic-bezier(0.34, 1.2, 0.64, 1), width 0.4s cubic-bezier(0.34, 1.2, 0.64, 1)",
        }}
      />

      {navItems.map((item, index) => {
        const isActive = index === activeIndex;

        if (item.id === "record") {
          return (
            <div
              key={item.id}
              className="flex-1 flex flex-col items-center gap-0.5 relative z-10"
            >
              <button
                className="w-14 h-14 rounded-full flex items-center justify-center bg-primary-lighter text-background transition-opacity hover:opacity-85"
                style={{ boxShadow: "0 0 16px rgba(96,165,250,0.3)" }}
                onClick={() => handleNavigation(item)}
                aria-label={item.label}
              >
                {item.icon}
              </button>
              <span
                className={cn(
                  "text-xs",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </div>
          );
        }

        return (
          <button
            key={item.id}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-full relative z-10 transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            onClick={() => handleNavigation(item)}
            aria-label={item.label}
          >
            {item.icon}
            <span className="text-xs">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
