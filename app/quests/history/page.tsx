"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy } from "lucide-react";
import { Button } from "../../components/Button";
import type { CompletedQuest } from "@/lib/types";

export default function QuestHistoryPage() {
  const router = useRouter();
  const [completedQuests, setCompletedQuests] = useState<CompletedQuest[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("vibequest_completed_quests");
    if (stored) {
      setCompletedQuests(JSON.parse(stored));
    }
  }, []);

  const totalXp = completedQuests.reduce((sum, q) => sum + q.xpEarned, 0);

  return (
    <main className="h-full bg-[#fafafa] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-5 pt-4 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push("/profile")}
            size="icon"
            variant="secondary"
            ariaLabel="Back to Profile"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-black text-[#1a1a1a] tracking-tight">Quest History</h1>
        </div>
      </header>

      {/* Summary Card */}
      <div className="px-5 pb-4 flex-shrink-0">
        <div className="bg-[#a3e635] border-2 border-[#1a1a1a] rounded-xl p-4 hard-shadow flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white hard-border flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[#1a1a1a]" />
            </div>
            <div>
              <p className="text-2xl font-black text-[#1a1a1a]">{completedQuests.length}</p>
              <p className="text-xs font-bold text-[#1a1a1a]/70">Quests Completed</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-[#1a1a1a]">{totalXp}</p>
            <p className="text-xs font-bold text-[#1a1a1a]/70">Total XP</p>
          </div>
        </div>
      </div>

      {/* Quest List */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {completedQuests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-xl bg-[#e5e5e5] hard-border flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-[#999]" />
            </div>
            <p className="text-[#666] text-sm font-medium">No quests completed yet!</p>
            <p className="text-[#999] text-xs mt-1">Start your first quest to see it here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedQuests.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white border-2 border-[#1a1a1a] rounded-xl p-4 hard-shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-[#1a1a1a]">{item.quest.title}</h4>
                    <p className="text-xs text-[#666] mt-1 line-clamp-2">{item.quest.description}</p>
                    <p className="text-xs text-[#999] mt-2">
                      {new Date(item.completedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {" · "}
                      {Math.floor(item.duration / 60)}m {item.duration % 60}s
                      {" · "}
                      {item.rating === "loved_it" ? "🤩" : item.rating === "good" ? "😁" : item.rating === "meh" ? "😐" : "✨"}
                    </p>
                  </div>
                  <span className="text-sm font-black text-[#a3e635] bg-[#a3e635]/10 px-3 py-1 rounded-full flex-shrink-0">
                    +{item.xpEarned}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
