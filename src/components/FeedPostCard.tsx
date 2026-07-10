import React, { useState } from "react";
import { Heart, MapPin, Sparkles, ShoppingBag, Eye, X, ShieldAlert, MessageCircle } from "lucide-react";
import { FeedPost, MenuItem, KitchenDetails } from "../types";
import { motion, AnimatePresence } from "motion/react";

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
  currentUserRole?: string;
  commentCount?: number;
  isFollowed?: boolean;
  onToggleFollow?: (kitchenId: string) => void;
  onOpenComments?: (postId: string) => void;
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
  onToggleAiSparkle,
  currentUserRole,
  commentCount = 0,
  isFollowed = false,
  onToggleFollow,
  onOpenComments
}: FeedPostCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isLikeThrottled, setIsLikeThrottled] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  if (!kitchen) return null;
  const isOnline = kitchen.operatingMode === "online";

  // Prevent missing parameters crash by resolving taggedItem strictly
  const taggedItem = menuItems.find(mi => mi.id === post.taggedItemId);
  const showTaggedItem = !!(taggedItem && isOnline);
  const creatorHandle = kitchen.handle ? `@${kitchen.handle}` : null;

  // Debounce click and double-tap gestures to prevent voting race conditions
  const handleLikeTrigger = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (isLikeThrottled) return;
    setIsLikeThrottled(true);
    onDoubleTap(post.id);
    setTimeout(() => {
      setIsLikeThrottled(false);
    }, 800);
  };

  return (
    <>
      <motion.div
        id={`post-${post.id}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="bg-white dark:bg-slate-900 rounded-[24px] border border-gray-100 dark:border-slate-850 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(255,94,58,0.05)] transition-all duration-300 flex flex-col"
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-gray-50 dark:border-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-primary/10 dark:bg-brand-primary-container overflow-hidden flex items-center justify-center font-bold text-base text-brand-primary shrink-0">
              {kitchen.profileImageUrl ? (
                <img src={kitchen.profileImageUrl} alt={`${post.kitchenName} profile`} className="w-full h-full object-cover" />
              ) : (
                "🍳"
              )}
            </div>
            <div>
              <h3
                onClick={() => {
                  onSelectKitchen(post.kitchenId);
                  onSelectTab("directory");
                }}
                className="font-extrabold text-xs text-gray-950 dark:text-slate-100 cursor-pointer hover:text-brand-primary transition-colors flex items-center gap-1"
              >
                <span>{post.kitchenName}</span>
                <span className="text-[10px] text-brand-primary animate-pulse">✨</span>
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[9px] text-brand-primary font-bold tracking-wider uppercase">Verified Chef</p>
                  {creatorHandle && (
                    <p className="text-[9px] text-gray-500 dark:text-slate-400 font-mono">{creatorHandle}</p>
                  )}
                </div>
                {kitchen.deliveryLocations && kitchen.deliveryLocations.length > 0 && (
                  <p className="text-[9px] text-gray-400 dark:text-slate-400 truncate max-w-[130px]" title={kitchen.deliveryLocations.join(", ")}>
                    • Delivers to {kitchen.deliveryLocations.map(loc => loc.split(" - ").pop()).join(", ")}
                  </p>
                )}
              </div>
            </div>
          </div>

          <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-wider transition-all duration-200 ${
            isOnline 
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10" 
              : "bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500"
          }`}>
            {isOnline ? "Active" : "Offline"}
          </span>
        </div>

        {/* Image Frame with Double Tap */}
        <div
          onDoubleClick={handleLikeTrigger}
          className="relative aspect-video bg-slate-950 overflow-hidden cursor-pointer group"
        >
          {currentUserRole === "kitchen" ? (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none border border-slate-850">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-2">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-xs font-black text-rose-500 uppercase tracking-widest mb-1">Competitor Shield Active</p>
              <p className="text-[10px] text-slate-400 max-w-xs leading-normal">
                Visual assets and commercial pricing are strictly shielded for Chef profiles to prevent community undercutting and market espionage.
              </p>
            </div>
          ) : (
            <>
              {/* Stable Skeleton Shimmer block for Cumulative Layout Shift (CLS) protection */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: "200% 100%" }} />
                </div>
              )}
              <img
                src={post.imageUrl}
                alt="Delicious food dish"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
                className={`w-full h-full object-cover select-none group-hover:scale-[1.03] transition-all duration-700 ease-out ${
                  imageLoaded ? "opacity-100" : "opacity-0"
                }`}
                referrerPolicy="no-referrer"
              />
              {(!post.imageUrl || post.imageUrl.trim() === "") && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-300 text-xs font-bold">
                  Image unavailable
                </div>
              )}
            </>
          )}

          {/* Frosted Glass Quick-View Magnifier Button */}
          {currentUserRole !== "kitchen" && (
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenImage(post.imageUrl);
                }}
                className="px-4 py-2 rounded-full bg-white/20 dark:bg-black/30 backdrop-blur-md border border-white/30 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg hover:bg-white/35 dark:hover:bg-black/45 transition-all scale-95 group-hover:scale-100 duration-300"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Inspect Dish</span>
              </button>
            </div>
          )}

          {/* Double Tap Heart Burst Animation */}
          <AnimatePresence>
            {doubleTappedPostId === post.id && currentUserRole !== "kitchen" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1.2 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Heart className="w-24 h-24 text-brand-primary fill-current drop-shadow-2xl filter saturate-150" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Sparkle Badge Overlay */}
          {(post.hasAiSparkle || post.aiSparkleImposed) && currentUserRole !== "kitchen" && (
            <div className="absolute top-3 left-3 bg-brand-primary/90 text-white backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 shadow-md border border-white/20 animate-pulse">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>AI Authenticated</span>
            </div>
          )}

          {/* Glassmorphic Shoppable Linked Tag Item (Swiggy / Instagram style overlay) */}
          {showTaggedItem && (
            <div className="absolute bottom-3 right-3">
              <button
                disabled={isAdding}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isAdding) return;
                  setIsAdding(true);
                  onAddToCart(taggedItem, post.kitchenId);
                  onSelectTab("cart");
                  setTimeout(() => setIsAdding(false), 800);
                }}
                className={`bg-white/10 hover:bg-white/20 dark:bg-black/20 dark:hover:bg-black/35 backdrop-blur-md border border-white/25 dark:border-white/10 text-white rounded-2xl px-4 py-2 text-[10px] font-black flex items-center gap-2 shadow-lg transition-all scale-100 hover:scale-[1.04] ${
                  isAdding ? "opacity-75 cursor-not-allowed" : ""
                }`}
              >
                <ShoppingBag className={`w-3.5 h-3.5 text-brand-primary ${isAdding ? "animate-spin" : "animate-bounce"}`} />
                <span>
                  Shop: {taggedItem.name} {currentUserRole === "kitchen" ? "• [Shielded]" : `• ₹${post.taggedItemPrice}`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footnotes & Likes Counter */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={handleLikeTrigger}
                className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                  isLiked 
                    ? "text-brand-primary hover:bg-brand-primary/10" 
                    : "text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5"
                }`}
              >
                <Heart className={`w-5.5 h-5.5 ${isLiked ? "fill-current" : ""}`} />
              </motion.button>
              <span className="text-[11px] font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
                {post.likes.length} resident verifications
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => onOpenComments?.(post.id)}
                className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-slate-300 hover:border-brand-primary/40 hover:text-brand-primary transition-all flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{commentCount} Comments</span>
              </button>
              {currentUserRole !== "kitchen" && onToggleFollow && (
                <button
                  type="button"
                  onClick={() => onToggleFollow(post.kitchenId)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                    isFollowed
                      ? "bg-brand-primary text-white border-brand-primary"
                      : "bg-white dark:bg-slate-950 text-brand-primary border-brand-primary/20 hover:border-brand-primary"
                  }`}
                >
                  {isFollowed ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
            <span className="font-extrabold text-gray-900 dark:text-slate-100 mr-2">{post.kitchenName}</span>
            {post.description}
          </p>

          {/* Admin Command Deck */}
          {isAdmin && onToggleAiSparkle && (
            <div className="p-3 bg-brand-primary/5 dark:bg-slate-800/40 border border-brand-primary/10 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-primary" />
                <span className="text-[9px] font-black text-brand-primary uppercase tracking-widest">
                  Trustee Shield Console
                </span>
              </div>
              <button
                onClick={() => onToggleAiSparkle(post.id, !!post.aiSparkleImposed)}
                className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  post.aiSparkleImposed
                    ? "bg-rose-500 hover:bg-rose-600 text-white"
                    : "bg-brand-primary hover:bg-brand-primary/90 text-white"
                }`}
              >
                {post.aiSparkleImposed ? "Strip Sparkle" : "Impose Sparkle"}
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Hero Fullscreen Inspect Modal */}
      <AnimatePresence>
        {fullscreenImage && currentUserRole !== "kitchen" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullscreenImage(null)}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-md"
          >
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              transition={{ type: "spring", damping: 25 }}
              src={fullscreenImage}
              alt="High-resolution dish inspect"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
