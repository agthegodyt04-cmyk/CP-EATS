import React, { useState } from "react";
import { Heart, MapPin, Sparkles, ShoppingBag, X, ShieldAlert, MessageCircle } from "lucide-react";
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

  // Resolve up to 5 tagged menu items
  const taggedItems = (post.taggedItemIds || [])
    .map(id => menuItems.find(mi => mi.id === id))
    .filter((mi): mi is MenuItem => !!mi && isOnline);
  const showTaggedItem = taggedItems.length > 0;
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
        {/* Header - Instagram style */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-brand-primary/10 dark:bg-brand-primary-container overflow-hidden flex items-center justify-center font-black text-xs text-brand-primary shrink-0 border border-brand-primary/10">
              {kitchen.profileImageUrl ? (
                <img src={kitchen.profileImageUrl} alt={post.kitchenName} className="w-full h-full object-cover" />
              ) : (
                "🍳"
              )}
            </div>
            <div>
              <p className="text-xs font-extrabold text-text-primary leading-tight">{post.kitchenName}</p>
              <p className="text-[9px] text-text-muted font-bold">{post.kitchenId ? post.kitchenId : ""}</p>
            </div>
          </div>
          {currentUserRole !== "kitchen" && onToggleFollow && (
            <button
              type="button"
              onClick={() => onToggleFollow(post.kitchenId)}
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                  isFollowed
                    ? "bg-brand-primary text-white border-brand-primary"
                    : "bg-white dark:bg-slate-950 text-brand-primary border-brand-primary/20 hover:border-brand-primary"
                }`}
            >
              {isFollowed ? "Following" : "Follow"}
            </button>
          )}
        </div>

        {/* Image Frame with Double Tap */}
        <div
          onDoubleClick={handleLikeTrigger}
          onClick={() => {
            if (currentUserRole !== "kitchen" && post.imageUrl) {
              setFullscreenImage(post.imageUrl);
            }
          }}
          className="relative aspect-video bg-slate-950 overflow-hidden cursor-pointer"
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
                className={`w-full h-full object-cover select-none transition-all duration-700 ease-out ${
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

          {/* Shoppable Tag - jumping bag only, bottom-left */}
          {showTaggedItem && currentUserRole !== "kitchen" && (
            <div className="absolute bottom-3 right-3">
              <button
                disabled={isAdding}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isAdding) return;
                  setIsAdding(true);
                  taggedItems.forEach(item => onAddToCart(item, post.kitchenId));
                  onSelectTab("cart");
                  setTimeout(() => setIsAdding(false), 800);
                }}
                className={`bg-white/10 hover:bg-white/20 dark:bg-black/20 dark:hover:bg-black/35 backdrop-blur-md border border-white/25 dark:border-white/10 text-white rounded-full p-2.5 shadow-lg transition-all ${
                  isAdding ? "opacity-75 cursor-not-allowed" : ""
                }`}
              >
                <ShoppingBag className={`w-4 h-4 text-brand-primary ${isAdding ? "animate-spin" : "animate-bounce"}`} />
              </button>
            </div>
          )}
        </div>

        {/* Footnotes & Actions - Instagram style */}
        <div className="px-4 pt-1.5 pb-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={handleLikeTrigger}
                className="text-text-primary hover:text-rose-500 transition-colors cursor-pointer"
              >
                <Heart className={`w-6 h-6 ${isLiked ? "fill-current text-rose-500" : ""}`} />
              </motion.button>
              <button
                type="button"
                onClick={() => onOpenComments?.(post.id)}
                className="text-text-primary hover:text-brand-primary transition-colors cursor-pointer"
              >
                <MessageCircle className="w-6 h-6" />
              </button>
            </div>
            <span className="text-[10px] text-text-muted font-bold">{post.likes?.length || 0} likes</span>
          </div>

          {/* Caption */}
          <div className="space-y-0.5">
            <p className="text-xs text-text-primary leading-relaxed">
              <span className="font-extrabold mr-1">{post.kitchenName}</span>
              {post.description}
            </p>
          </div>

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

      {/* Instagram-style lightbox */}
      <AnimatePresence>
        {fullscreenImage && currentUserRole !== "kitchen" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullscreenImage(null)}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          >
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white cursor-pointer transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              transition={{ type: "spring", damping: 25 }}
              src={fullscreenImage}
              alt="Full size dish"
              className="max-w-full max-h-[90vh] object-contain"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
