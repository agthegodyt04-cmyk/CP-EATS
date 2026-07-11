import React, { useState } from "react";
import { Heart, MapPin, Sparkles, ShoppingBag, X, ShieldAlert, MessageCircle, Plus, Minus } from "lucide-react";
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
  const [showTaggedPanel, setShowTaggedPanel] = useState(false);
  const [taggedQuantities, setTaggedQuantities] = useState<Record<string, number>>({});

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

  const handleBagClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTaggedPanel(true);
  };

  const handleAddItem = (item: MenuItem) => {
    setTaggedQuantities(prev => ({ ...prev, [item.id]: 1 }));
  };

  const handleIncrement = (item: MenuItem) => {
    setTaggedQuantities(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
  };

  const handleDecrement = (itemId: string) => {
    setTaggedQuantities(prev => {
      const current = prev[itemId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: current - 1 };
    });
  };

  const confirmAddToCart = (item: MenuItem) => {
    const qty = taggedQuantities[item.id] || 1;
    for (let i = 0; i < qty; i++) {
      onAddToCart(item, post.kitchenId);
    }
    setTaggedQuantities(prev => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
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

          {/* Shoppable Tag - jumping bag only, bottom-right */}
          {currentUserRole !== "kitchen" && (
            <div className="absolute bottom-3 right-3">
              <button
                disabled={isAdding}
                onClick={handleBagClick}
                className={`bg-white/10 hover:bg-white/20 dark:bg-black/20 dark:hover:bg-black/35 backdrop-blur-md border border-white/25 dark:border-white/10 text-white rounded-full p-2.5 shadow-lg transition-all ${
                  isAdding ? "opacity-75 cursor-not-allowed" : ""
                }`}
              >
                <ShoppingBag className={`w-5 h-5 text-orange-500 ${isAdding ? "animate-spin" : "animate-bounce"}`} />
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

      {/* Tagged Items Slide-up Panel */}
      <AnimatePresence>
        {showTaggedPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={() => setShowTaggedPanel(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 180 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-[32px] border-t border-gray-100 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] max-h-[70vh] flex flex-col"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-700" />
              </div>

              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-text-primary">Tagged Items</h3>
                  <p className="text-[10px] text-text-muted font-bold">{taggedItems.length} items from this post</p>
                </div>
                <button
                  onClick={() => setShowTaggedPanel(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-3 space-y-2">
                {taggedItems.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-xs text-text-muted font-bold">No items tagged in this post</p>
                  </div>
                )}
                {taggedItems.map(item => {
                  const qty = taggedQuantities[item.id] || 0;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-text-primary truncate">{item.name}</p>
                        <p className="text-[10px] text-text-muted font-bold">₹{item.price.toFixed(2)}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {qty > 0 ? (
                          <>
                            <button
                              onClick={() => handleDecrement(item.id)}
                              className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-text-primary hover:border-brand-primary transition-colors cursor-pointer"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-black text-text-primary w-6 text-center">{qty}</span>
                            <button
                              onClick={() => handleIncrement(item)}
                              className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center hover:bg-brand-primary/90 transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => confirmAddToCart(item)}
                              className="ml-1 px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Add
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleAddItem(item)}
                            className="px-4 py-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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