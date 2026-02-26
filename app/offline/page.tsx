"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="h-full flex flex-col items-center justify-center px-5 safe-top safe-x">
      <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6">
        <WifiOff className="w-10 h-10 text-slate-400" />
      </div>

      <h1 className="text-2xl font-bold text-white text-center mb-2">
        You&apos;re Offline
      </h1>

      <p className="text-slate-400 text-center mb-8 max-w-xs">
        No worries! Your last missions are saved. Reconnect to generate new vibes.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-6 py-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 font-medium tap-target"
      >
        <RefreshCw className="w-5 h-5" />
        Try Again
      </button>
    </main>
  );
}
