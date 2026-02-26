"use client";

import { useEffect, useState } from "react";
import { Target, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTapFeedback } from "../hooks/useTapFeedback";

const navItems = [
  { href: "/", icon: Target, label: "Quests" },
  { href: "/feed", icon: Users, label: "Feed" },
  { href: "/profile", icon: User, label: "Profile" },
];

function BottomNavContent() {
  const pathname = usePathname();
  const { withTap } = useTapFeedback();

  return (
    <div className="flex items-center justify-around h-full px-2 bg-white">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={withTap(() => {}, "light")}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-4 tap-target transition-all duration-200 rounded-xl m-1",
              isActive
                ? "bg-[#ff6b9d] text-white font-bold"
                : "text-[#666] hover:text-[#1a1a1a] hover:bg-[#f5f5f5]"
            )}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-xs mt-1 font-bold">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function MobileFrame({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#e5e5e5] flex items-center justify-center p-4 md:p-8">
      {/* Desktop: Phone Frame */}
      <div className="hidden md:block" data-phone-frame="true">
        <div className="relative">
          {/* Phone Outer Frame */}
          <div className="w-[390px] h-[844px] bg-[#1a1a1a] rounded-[50px] p-3 shadow-2xl">
            {/* Phone Inner Frame - Screen */}
            <div className="w-full h-full bg-[#fafafa] rounded-[38px] overflow-hidden relative">
              {/* Status Bar Area */}
              <div className="absolute top-0 left-0 right-0 h-6 bg-[#fafafa] z-20" />

              {/* Scrollable Content Area */}
              <div className="absolute inset-0 top-6 bottom-[76px] overflow-y-auto overflow-x-hidden no-scrollbar">
                {children}
              </div>

              {/* Fixed Bottom Nav - Inside the phone frame */}
              <div className="absolute bottom-[10px] left-0 right-0 h-[66px] z-20">
                <BottomNavContent />
              </div>

              {/* Home Indicator */}
              <div className="absolute bottom-0 left-0 right-0 h-[10px] bg-[#fafafa] z-20 flex items-start justify-center pt-1">
                <div className="w-32 h-1 bg-[#1a1a1a]/20 rounded-full" />
              </div>
            </div>
          </div>

          {/* Side Buttons */}
          <div className="absolute top-[120px] -left-1 w-1 h-8 bg-[#333] rounded-l" />
          <div className="absolute top-[180px] -left-1 w-1 h-16 bg-[#333] rounded-l" />
          <div className="absolute top-[160px] -right-1 w-1 h-20 bg-[#333] rounded-r" />
        </div>
      </div>

      {/* Mobile: Full Screen */}
      <div className="md:hidden w-full h-screen overflow-hidden flex flex-col bg-[#fafafa]">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          {children}
        </div>
        {/* Fixed nav at bottom */}
        <div className="h-[66px] flex-shrink-0 bg-white border-t-2 border-[#1a1a1a] safe-bottom">
          <BottomNavContent />
        </div>
      </div>
    </div>
  );
}
