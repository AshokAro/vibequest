"use client";

// TODO: BottomNav is currently unused (bottom nav was removed from app)
// Keeping for potential future use - remove if navigation structure stays as-is

import { useEffect, useState, useRef } from "react";
import { Home, Compass, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/quests", icon: Compass, label: "Quests" },
  { href: "/feed", icon: Users, label: "Feed" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [isDesktop, setIsDesktop] = useState(false);
  const [navPosition, setNavPosition] = useState<{ bottom: number; width: number } | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);

      if (desktop) {
        // Calculate position relative to the phone frame
        const phoneFrame = document.querySelector('[data-phone-frame="true"]');
        if (phoneFrame) {
          const rect = phoneFrame.getBoundingClientRect();
          setNavPosition({
            bottom: window.innerHeight - rect.bottom + 10,
            width: rect.width - 24, // Account for padding
          });
        }
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, []);

  const navContent = (
    <div className="flex items-center justify-around h-full px-2 bg-white">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
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

  // Desktop: fixed position calculated to align with phone frame
  if (isDesktop && navPosition) {
    return (
      <nav
        className="fixed z-[100] h-[66px] border-t-2 border-[#1a1a1a]"
        style={{
          width: navPosition.width,
          bottom: navPosition.bottom,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        {navContent}
      </nav>
    );
  }

  // Mobile: fixed at bottom
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-[66px] bg-white border-t-2 border-[#1a1a1a] safe-bottom">
      {navContent}
    </nav>
  );
}
