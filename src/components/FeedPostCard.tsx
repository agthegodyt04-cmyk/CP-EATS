import React from "react";
import { Heart, MapPin, Sparkles } from "lucide-react";
import { FeedPost, MenuItem, KitchenDetails } from "../types";

interface FeedPostCardProps {
  key?: any;
  post: FeedPost;
  currentUserId: string;
  isLiked: boolean;
  kitchen: KitchenDetails | undefined;
  menuItems: MenuItem[];
  doubleTappedPostId: string | null;
  onDoubleTap: (postId: string) => void | Promise<void>;
  onAddToCart: (item: MenuItem, kitchenId: string, selectedAddOns?: any[]) => void;
  onSelectKitchen: (kitchenId: string) => void;
  onSelectTab: (tab: "feed" | "directory" | "cart" | "orders") => void;
  isAdmin?: boolean;
  onToggleAiSparkle?: (postId: string, currentStatus: boolean) => void;
}

export default function FeedPostCard({
  post,
  currentUserId,
  isLiked,
  kitchen,
  menuItems,
  doubleTappedPostId,
  onDoubleTap,
  onAddToCart,
  onSelectKitchen,
  onSelectTab,
  isAdmin,
  onToggleAiSparkle
}: FeedPostCardProps) {
  if (!kitchen) return null;
  const isOnline = kitchen.operatingMode === "online";

  return (
    <div
      id={`post-${post.id}`}
      className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xs overflow-hidden hover:shadow-md transition-all animate-fade-in"
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-gray-50 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-indigo-700 dark:text-indigo-400">
            🍳
          </div>
          <div>
            <h3
              onClick={() => {
                onSelectKitchen(post.kitchenId);
                onSelectTab("directory");
              }}
              className="font-bold text-xs text-gray-950 dark:text-slate-100 cursor-pointer hover:underline"
            >
              {post.kitchenName}
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-[9px] text-gray-400 dark:text-slate-400 font-medium">Verified Centurian Chef</p>
              {kitchen.deliveryLocations && kitchen.deliveryLocations.length > 0 && (
                <>
                  <span className="text-[9px] text-gray-300">•</span>
                  <p className="text-[9px] text-indigo-500 font-semibold truncate max-w-[150px]" title={kitchen.deliveryLocations.join(", ")}>
                    🚚 Delivers to: {kitchen.deliveryLocations.map(loc => loc.split(" - ").pop()).join(", ")}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
          isOnline 
            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400" 
            : "bg-gray-100 dark:bg-slate-800 text-gray-400"
        }`}>
          {isOnline ? "Online Now" : "Resting"}
        </span>
      </div>

      {/* Image Scroll Media with Double Tap */}
      <div
        onDoubleClick={() => onDoubleTap(post.id)}
        className="relative aspect-video bg-slate-900 overflow-hidden cursor-pointer group"
      >
        <img
          src={post.imageUrl}
          alt="Delicious food dish"
          className="w-full h-full object-cover select-none"
          referrerPolicy="no-referrer"
        />

        {/* Floating Heart Micro Animation */}
        {doubleTappedPostId === post.id && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-scale-up">
            <Heart className="w-20 h-20 text-rose-500 fill-current drop-shadow-md" />
          </div>
        )}

        {/* AI Sparkle Tag Overlay */}
        {(post.hasAiSparkle || post.aiSparkleImposed) && (
          <div className="absolute top-3 left-3 bg-indigo-600/90 hover:bg-indigo-700/90 text-white backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-md border border-indigo-400/30 transition-all select-none animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>AI Sparkle</span>
            {post.aiSparkleImposed && (
              <span className="text-[8px] bg-indigo-800/85 text-indigo-200 px-1 py-0.2 rounded-sm uppercase tracking-widest ml-1 font-bold">
                Admin
              </span>
            )}
          </div>
        )}
      </div>

      {/* Details and Action Badges */}
      <div className="p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          {/* Likes counter */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onDoubleTap(post.id)}
              className="p-1 rounded-full text-rose-500 hover:scale-110 transition-transform cursor-pointer"
            >
              <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
            </button>
            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
              {post.likes.length} verification likes
            </span>
          </div>

          {/* Shoppable Linked Tag Item */}
          {post.taggedItemId && isOnline && (
            <button
              onClick={() => {
                const taggedItem = menuItems.find(mi => mi.id === post.taggedItemId);
                if (taggedItem) {
                  onAddToCart(taggedItem, post.kitchenId);
                  onSelectTab("cart");
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-1.5 text-[10px] font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <span>[@] Shop Dish • ₹{post.taggedItemPrice}</span>
            </button>
          )}
        </div>

        {/* Admin AI Sparkle Action Button */}
        {isAdmin && onToggleAiSparkle && (
          <div className="p-2 bg-indigo-50/50 dark:bg-slate-800/50 border border-indigo-100/50 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-2.5 animate-fade-in">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-950 dark:text-slate-200 uppercase tracking-wider">
                Shield Mod Controls:
              </span>
            </div>
            <button
              onClick={() => onToggleAiSparkle(post.id, !!post.aiSparkleImposed)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                post.aiSparkleImposed
                  ? "bg-rose-500 hover:bg-rose-600 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {post.aiSparkleImposed ? "Remove AI Sparkle" : "Impose AI Sparkle"}
            </button>
          </div>
        )}

        <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
          <span className="font-extrabold text-gray-900 dark:text-slate-100 mr-1.5">{post.kitchenName}</span>
          {post.description}
        </p>
      </div>
    </div>
  );
}
