"use client";

import { useEffect, useState } from "react";

export function MobileFrame({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen md:bg-[#e5e5e5] md:flex md:items-center md:justify-center md:p-4 md:p-8">
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
              <div className="absolute inset-0 top-6 bottom-[10px] overflow-y-auto overflow-x-hidden no-scrollbar">
                {children}
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

      {/* Mobile: Full Screen - No grey container, no bottom nav */}
      <div className="md:hidden fixed inset-0 w-full h-[100dvh] overflow-hidden flex flex-col bg-[#fafafa]">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
