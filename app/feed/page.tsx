"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Dices, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedItem } from "@/lib/types";

const mockFeedItems: FeedItem[] = [
  {
    id: "1",
    mission_title: "Sunset Photography Walk",
    reflection: "Found a beautiful hidden garden I never knew existed. The golden hour light was perfect.",
    author_name: "Alex",
    completed_at: "2024-01-15T14:30:00Z",
    likes: 12,
  },
  {
    id: "2",
    mission_title: "Try a New Coffee Shop",
    reflection: "The barista recommended an Ethiopian single origin. Game changer!",
    author_name: "Jordan",
    completed_at: "2024-01-15T12:15:00Z",
    likes: 8,
  },
  {
    id: "3",
    mission_title: "Park Bench Meditation",
    reflection: "10 minutes of just watching clouds. Felt surprisingly restorative.",
    author_name: "Sam",
    completed_at: "2024-01-14T18:45:00Z",
    likes: 23,
  },
  {
    id: "4",
    mission_title: "Sketch a Building",
    reflection: "My perspective drawing needs work, but I noticed architectural details I'd never seen before.",
    author_name: "Casey",
    completed_at: "2024-01-14T16:20:00Z",
    likes: 15,
  },
  {
    id: "5",
    mission_title: "Explore a New Neighborhood",
    reflection: "Got lost on purpose and found the cutest bookstore cafe.",
    author_name: "Morgan",
    completed_at: "2024-01-13T11:00:00Z",
    likes: 31,
  },
];

const authorColors = [
  "bg-[#ff6b9d]",
  "bg-[#c084fc]",
  "bg-[#22d3ee]",
  "bg-[#a3e635]",
  "bg-[#fbbf24]",
];

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function FeedCard({
  item,
  onTryThis,
  colorIndex,
}: {
  item: FeedItem;
  onTryThis: (title: string) => void;
  colorIndex: number;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likes);

  const handleLike = () => {
    if (liked) {
      setLikeCount((prev) => prev - 1);
    } else {
      setLikeCount((prev) => prev + 1);
    }
    setLiked(!liked);
  };

  const authorColor = authorColors[colorIndex % authorColors.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-[#1a1a1a] rounded-xl p-3 hard-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg hard-border flex items-center justify-center text-white font-black text-sm", authorColor)}>
            {item.author_name[0]}
          </div>
          <div>
            <p className="text-xs font-black text-[#1a1a1a]">{item.author_name}</p>
            <p className="text-[10px] font-bold text-[#666]">{formatRelativeTime(item.completed_at)}</p>
          </div>
        </div>
      </div>

      <h3 className="text-sm font-black text-[#ff6b9d] mb-1">{item.mission_title}</h3>
      <p className="text-xs text-[#666] font-medium leading-relaxed mb-3">{item.reflection}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1 tap-target transition-all font-bold",
              liked ? "text-[#ff6b9d]" : "text-[#666] hover:text-[#1a1a1a]"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", liked && "fill-current")} />
            <span className="text-[10px]">{likeCount}</span>
          </button>
          <button className="flex items-center gap-1 text-[#666] hover:text-[#1a1a1a] tap-target transition-colors font-bold">
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="text-[10px]">Comment</span>
          </button>
        </div>

        <button
          onClick={() => onTryThis(item.mission_title)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#22d3ee] border-2 border-[#1a1a1a] rounded-lg text-[#1a1a1a] text-[10px] font-black tap-target hard-shadow-sm hover:-translate-y-0.5 transition-all"
        >
          <Dices className="w-3 h-3" />
          Try This
        </button>
      </div>
    </motion.div>
  );
}

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>(mockFeedItems);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;

    setLoading(true);
    setTimeout(() => {
      const newItems = mockFeedItems.map((item) => ({
        ...item,
        id: `${item.id}-${Date.now()}`,
      }));
      setItems((prev) => [...prev, ...newItems]);
      setLoading(false);

      if (items.length > 15) {
        setHasMore(false);
      }
    }, 1000);
  }, [loading, hasMore, items.length]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore]);

  const handleTryThis = (missionTitle: string) => {
    sessionStorage.setItem(
      "missionRequest",
      JSON.stringify({
        duration: 30,
        mood: "adventurous",
        energy: "medium",
      })
    );
    window.location.href = "/missions";
  };

  return (
    <main className="min-h-screen safe-top safe-x pb-24 bg-[#fafafa]">
      {/* Header */}
      <header className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg bg-[#c084fc] hard-border hard-shadow flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#1a1a1a] tracking-tight">Community Vibes</h1>
            <p className="text-xs font-medium text-[#666]">See what others are exploring</p>
          </div>
        </div>
      </header>

      {/* Feed */}
      <div className="px-5 space-y-3">
        {items.map((item, idx) => (
          <FeedCard key={item.id} item={item} onTryThis={handleTryThis} colorIndex={idx} />
        ))}

        <div ref={loadMoreRef} className="py-3 flex justify-center">
          {loading && (
            <div className="w-5 h-5 border-2 border-[#ff6b9d] border-t-transparent rounded-full animate-spin" />
          )}
          {!hasMore && !loading && (
            <p className="text-xs text-[#666] font-bold">You&apos;ve seen it all!</p>
          )}
        </div>
      </div>
    </main>
  );
}
