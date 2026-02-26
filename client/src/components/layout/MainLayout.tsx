import { ReactNode } from "react";
import BottomNav from "@/components/layout/BottomNav";
import Header from "@/components/layout/Header";

type MainLayoutProps = {
  children: ReactNode;
};

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header component removed from here to prevent duplicate headers */}

      <main className="main-content px-4 py-4">{children}</main>

      <BottomNav />
    </div>
  );
}
