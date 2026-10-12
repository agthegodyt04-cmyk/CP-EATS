import React, { useState, useEffect } from "react";
import { collection, buildQuery, where, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, orderBy, limit, doc, db } from "../db";
import { UserProfile, KitchenDetails, MenuItem, FeedPost, Order, OrderItem, SelectedAddOn, Follow, PostComment } from "../types";
import { Search, ShoppingBag, Clipboard, Check, Heart, Shield, HelpCircle, MapPin, MessageSquare, AlertTriangle, Star, LogOut, Coffee, ArrowLeft, Sun, Moon, Bell, RefreshCw, X, Wheat } from "lucide-react";
import Chat from "./Chat";
import ReviewDialog from "./ReviewDialog";
import FeedPostCard from "./FeedPostCard";
import PastMealsReorder from "./PastMealsReorder";
import { compressImage } from "../utils/imageUtils";

interface CustomerDashboardProps {
  currentProfile: UserProfile;
  onLogout: () => void;
  onOpenAdmin: () => void;
  showAdminBtn: boolean;
}

export default function CustomerDashboard({ currentProfile, onLogout, onOpenAdmin, showAdminBtn }: CustomerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"feed" | "directory" | "cart" | "orders" | "profile">("feed");
  const [kitchens, setKitchens] = useState<KitchenDetails[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Navigation / Selection State
  const [selectedKitchenId, setSelectedKitchenId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Search / Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "non-veg">("all");

  // Menu-Specific Dietary Filter States
  const [menuVegFilter, setMenuVegFilter] = useState<"all" | "veg" | "non-veg">("all");
  const [menuGlutenFreeFilter, setMenuGlutenFreeFilter] = useState(false);
  const [menuNutFreeFilter, setMenuNutFreeFilter] = useState(false);

  // Local theme state to reflect toggles immediately
  const [themePreference, setThemePreference] = useState<"light" | "dark">(currentProfile.themePreference === "dark" ? "dark" : "light");

  // Cart State (Key: Unique Combo Key, Value: { item, quantity, kitchenId, selectedAddOns?: SelectedAddOn[] })
  const [cart, setCart] = useState<{ [cartKey: string]: { item: MenuItem; quantity: number; kitchenId: string; selectedAddOns?: SelectedAddOn[] } }>({});

  // Reviews State
  const [reviews, setReviews] = useState<any[]>([]);

  // Favorites State
  const [favorites, setFavorites] = useState<any[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [selectedCommentPostId, setSelectedCommentPostId] = useState<string | null>(null);

  // Visual state
  const [likedPosts, setLikedPosts] = useState<{ [postId: string]: boolean }>({});
  const [doubleTappedPostId, setDoubleTappedPostId] = useState<string | null>(null);

  // Keep local theme in sync when profile theme changes externally
  React.useEffect(() => {
    setThemePreference(currentProfile.themePreference === "dark" ? "dark" : "light");
  }, [currentProfile.themePreference]);

  useEffect(() => {
    setLikedPosts(prev => {
      const next = { ...prev };
      for (const post of feedPosts) {
        if (post.id && !(post.id in next)) {
          next[post.id] = Array.isArray(post.likes) && post.likes.includes(currentProfile.uid);
        }
      }
      return next;
    });
  }, [feedPosts, currentProfile.uid]);
  const [toastMessage, setToastMessage] = useState("");
  const [showReviewOrderId, setShowReviewOrderId] = useState<string | null>(null);

  // Customizable Add-ons Modal State
  const [addOnSelectionItem, setAddOnSelectionItem] = useState<MenuItem | null>(null);
  const [addOnSelections, setAddOnSelections] = useState<Record<string, string[]>>({}); // groupId -> optionId[]

  // Scheduling State
  const [scheduleMode, setScheduleMode] = useState<"asap" | "later">("asap");
  const [scheduledTime, setScheduledTime] = useState("");

  // Security and Address Disputes State
  const [securityAlerts, setSecurityAlerts] = useState<{ id: string; title: string; text: string; createdAt: number }[]>([]);

  const dismissSecurityAlert = async (alertId: string) => {
    try {
      await deleteDoc(doc(db, "notifications", alertId));
      showNotificationToast("Notification dismissed successfully.");
    } catch (err) {
      console.error("Failed to dismiss notification:", err);
    }
  };

  // Enlarged Image Modal
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Return Button compatibility state reference
  const isHistoryUpdate = React.useRef(false);

  // Clipboard copy state for chats/orders
  const [copiedPin, setCopiedPin] = useState(false);

  // Real-time notifications toast list
  const [notifications, setNotifications] = useState<{ id: string; message: string; createdAt: number }[]>([]);

  const showNotificationToast = (msg: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, message: msg, createdAt: Date.now() }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4500);
  };

  const prevOrdersRef = React.useRef<Order[]>([]);
  const followKitchenIds = new Set(follows.map(f => f.kitchenId));

  useEffect(() => {
    if (orders.length > 0 && prevOrdersRef.current.length > 0) {
      orders.forEach((currOrder) => {
        const prevOrder = prevOrdersRef.current.find(o => o.id === currOrder.id);
        if (prevOrder && prevOrder.status !== currOrder.status) {
          const statusDetails: Record<string, string> = {
            PENDING: "Placed (Waiting Approval) 📋",
            ACCEPTED: "Accepted by Chef 👨‍🍳",
            PREPARING: "Cooking / Preparing 🍳",
            OUT_FOR_DELIVERY: "Out for Delivery 🚴",
            DELIVERED: "Delivered to your doorstep ✅",
            COMPLETED: "Completed successfully (Handshake Verified) 🎉",
            CANCELLED: "Cancelled ❌"
          };
          const friendlyStatus = statusDetails[currOrder.status] || currOrder.status;
          showNotificationToast(`"${currOrder.kitchenName}" updated order status to ${friendlyStatus}`);
        }
      });
    }
    prevOrdersRef.current = orders;
  }, [orders]);

  const toggleFavorite = async (item: MenuItem) => {
    const favId = `fav_${currentProfile.uid}_${item.id}`;
    const isFav = favorites.some(f => f.menuItemId === item.id);
    
    try {
      if (isFav) {
        await deleteDoc(doc(db, "favorites", favId));
        showToast(`Removed "${item.name}" from your Favorites! 💔`);
      } else {
        await setDoc(doc(db, "favorites", favId), {
          id: favId,
          userId: currentProfile.uid,
          menuItemId: item.id,
          kitchenId: item.kitchenId,
          name: item.name,
          price: item.price,
          imageUrl: item.imageUrl || "",
          isVeg: item.isVeg,
          createdAt: new Date().toISOString()
        });
        showToast(`Saved "${item.name}" to your Favorites! ❤️`);
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      showToast("Failed to update favorite state.");
    }
  };

  const handleToggleTheme = async () => {
    const nextTheme = themePreference === "dark" ? "light" : "dark";
    try {
      await updateDoc(doc(db, "users", currentProfile.uid), {
        themePreference: nextTheme
      });
      setThemePreference(nextTheme);
      if (nextTheme === "dark") {
        document.documentElement.classList.add("dark");
        document.body.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.body.classList.remove("dark");
      }
      showToast(`Switched to ${nextTheme} mode!`);
    } catch (err) {
      console.error("Failed to update theme preference:", err);
      showToast("Failed to switch theme.");
    }
  };

  const handleReorder = (pastOrder: Order) => {
    const firstCartItem = getCartList()[0];
    if (firstCartItem && firstCartItem.kitchenId !== pastOrder.kitchenId) {
      if (!window.confirm(`You already have items from another kitchen in your cart. Clear cart and reorder from "${pastOrder.kitchenName}"?`)) {
        return;
      }
    }

    const newCart: Record<string, { item: MenuItem; quantity: number; kitchenId: string; selectedAddOns?: SelectedAddOn[] }> = {};

    pastOrder.items.forEach((ordItem) => {
      const menuItem = menuItems.find(mi => mi.id === ordItem.itemId) || {
        id: ordItem.itemId,
        kitchenId: pastOrder.kitchenId,
        name: ordItem.name,
        description: "",
        price: ordItem.price,
        isVeg: true,
        isAvailable: true,
        category: "Main Course",
        createdAt: Date.now()
      };

      const addOns = ordItem.selectedAddOns || [];
      const addOnsKey = addOns.length > 0 
        ? "_" + addOns.map(ao => ao.optionId).sort().join("-")
        : "";
      const cartKey = `${menuItem.id}${addOnsKey}`;

      newCart[cartKey] = {
        item: menuItem,
        quantity: ordItem.quantity,
        kitchenId: pastOrder.kitchenId,
        selectedAddOns: addOns
      };
    });

    setCart(newCart);
    setActiveTab("cart");
    showToast(`Loaded ${pastOrder.items.length} items from previous order! 🛒`);
  };

  // Handle return button compatibility (back gestures / back buttons on iOS/Android/Desktop)
  useEffect(() => {
    window.history.replaceState({ tab: activeTab, kitchenId: selectedKitchenId, orderId: selectedOrderId }, "");

    const handlePopState = (e: PopStateEvent) => {
      if (e.state) {
        isHistoryUpdate.current = true;
        setActiveTab(e.state.tab || "feed");
        isHistoryUpdate.current = true;
        setSelectedKitchenId(e.state.kitchenId || null);
        isHistoryUpdate.current = true;
        setSelectedOrderId(e.state.orderId || null);
      } else {
        isHistoryUpdate.current = true;
        setSelectedKitchenId(null);
        isHistoryUpdate.current = true;
        setSelectedOrderId(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (isHistoryUpdate.current) {
      isHistoryUpdate.current = false;
      return;
    }
    window.history.pushState({
      tab: activeTab,
      kitchenId: selectedKitchenId,
      orderId: selectedOrderId
    }, "");
  }, [activeTab, selectedKitchenId, selectedOrderId]);

  // Reset menu specific filters when selected kitchen changes
  useEffect(() => {
    setMenuVegFilter("all");
    setMenuGlutenFreeFilter(false);
    setMenuNutFreeFilter(false);
  }, [selectedKitchenId]);

  // Helper to get typed cart items list
  const getCartList = () => Object.entries(cart).map(([key, val]) => {
    const value = val as { item: MenuItem; quantity: number; kitchenId: string; selectedAddOns?: SelectedAddOn[] };
    return {
      cartKey: key,
      item: value.item,
      quantity: value.quantity,
      kitchenId: value.kitchenId,
      selectedAddOns: value.selectedAddOns
    };
  });

  const checkKitchenDelivers = (kitchen: KitchenDetails) => {
    if (!kitchen) return false;
    if (!kitchen.deliveryLocations || kitchen.deliveryLocations.length === 0) {
      return (kitchen.society || "") === currentProfile.society;
    }
    return kitchen.deliveryLocations.some(loc => {
      if (typeof loc !== "string") return false;
      const parts = loc.split(" - ");
      if (parts.length < 3) return false;
      const socName = parts[0] + " - " + parts[1];
      const towerName = parts[2];
      return currentProfile.society === socName && (currentProfile.flatAddress || "").includes(towerName);
    });
  };

  // Fetch initial data
  useEffect(() => {
    const toMillis = (value: unknown): number => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value) {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    // 1. Fetch kitchen profiles (secret-free projection) to associate societies with kitchens
    // Supabase rows use `id`; app types use `uid`. Normalize both so directory/feed matching works.
    const qKitchenProfiles = buildQuery(collection(db, "public_profiles"), where("role", "==", "kitchen"), where("status", "==", "verified"));
    let unsubDetails: (() => void) | null = null;
    const unsubKitchens = onSnapshot(qKitchenProfiles, (pSnap) => {
      const societiesMap: Record<string, string> = {};
      const flatAddressMap: Record<string, string> = {};
      pSnap.forEach((profileDoc) => {
        const d = profileDoc.data() as Record<string, any>;
        const profileId = d.uid || d.id || profileDoc.id;
        if (!profileId) return;
        if (d.society) societiesMap[profileId] = d.society;
        if (d.flatAddress) flatAddressMap[profileId] = d.flatAddress;
      });

      if (unsubDetails) {
        (unsubDetails as () => void)();
      }
      
      unsubDetails = onSnapshot(collection(db, "kitchens"), (kSnap) => {
        const list: KitchenDetails[] = [];
        kSnap.forEach((kitchenDoc) => {
          const kData = kitchenDoc.data() as Record<string, any>;
          const kitchenUid = kData.uid || kData.id || kitchenDoc.id;
          if (!kitchenUid) return;
          list.push({
            ...(kData as KitchenDetails),
            uid: kitchenUid,
            // Prefer kitchen row society (set at onboarding); fall back to linked user profile
            society: kData.society || societiesMap[kitchenUid] || "",
            flatAddress: kData.flatAddress || flatAddressMap[kitchenUid] || "",
            deliveryLocations: Array.isArray(kData.deliveryLocations)
              ? kData.deliveryLocations
              : (typeof kData.deliveryLocations === "string"
                  ? (() => { try { return JSON.parse(kData.deliveryLocations); } catch { return []; } })()
                  : []),
            customCategories: Array.isArray(kData.customCategories) ? kData.customCategories : [],
            vegType: kData.vegType || "veg",
            mov: typeof kData.mov === "number" ? kData.mov : 100,
            isOnline: kData.isOnline !== false,
            operatingMode: kData.operatingMode || "online",
            kitchenName: kData.kitchenName || "Home Kitchen",
          });
        });
        setKitchens(list);
      });
    });

    // 2. Fetch menu items
    const unsubMenu = onSnapshot(collection(db, "menu_items"), (snap) => {
      const list: MenuItem[] = [];
      snap.forEach((itemDoc) => {
        const data = itemDoc.data() as Record<string, any>;
        list.push({
          id: data.id || itemDoc.id,
          ...data,
          createdAt: toMillis(data.createdAt),
        } as MenuItem);
      });
      setMenuItems(list);
    });

    // 3. Fetch Feed posts
    const unsubFeed = onSnapshot(collection(db, "feed_posts"), (snap) => {
      const list: FeedPost[] = [];
      snap.forEach((postDoc) => {
        const data = postDoc.data() as Record<string, any>;
        const likes = Array.isArray(data.likes)
          ? data.likes
          : (typeof data.likes === "string"
              ? (() => { try { return JSON.parse(data.likes); } catch { return []; } })()
              : []);
        list.push({
          ...(data as FeedPost),
          id: data.id || postDoc.id,
          kitchenId: data.kitchenId || "",
          kitchenName: data.kitchenName || "Kitchen",
          description: data.description || "",
          imageUrl: data.imageUrl || "",
          likes,
          createdAt: toMillis(data.createdAt),
          hasAiSparkle: data.hasAiSparkle === true,
          aiSparkleImposed: data.aiSparkleImposed === true,
        });
      });
      // Sort fresh posts first
      list.sort((a, b) => b.createdAt - a.createdAt);
      setFeedPosts(list);
    });


    // 4. Fetch customer orders
    const qOrders = buildQuery(collection(db, "orders"), where("customerId", "==", currentProfile.uid));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const list: Order[] = [];
      snap.forEach((orderDoc) => {
        const data = orderDoc.data() as Record<string, any>;
        list.push({
          ...(data as Order),
          id: data.id || orderDoc.id,
          createdAt: toMillis(data.createdAt),
          items: Array.isArray(data.items)
            ? data.items
            : (typeof data.items === "string"
                ? (() => { try { return JSON.parse(data.items); } catch { return []; } })()
                : []),
        });
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      setOrders(list);
    });


    // 5. Fetch reviews
    const unsubReviews = onSnapshot(collection(db, "reviews"), (snap) => {
      const list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setReviews(list);
    });

    // 6. Fetch customer favorites
    const qFavorites = buildQuery(collection(db, "favorites"), where("userId", "==", currentProfile.uid));
    const unsubFavorites = onSnapshot(qFavorites, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setFavorites(list);
    }, (err) => {
      console.error("Failed to sync favorites:", err);
    });

    // 7. Fetch kitchen follows
    const qFollows = buildQuery(collection(db, "follows"), where("followerId", "==", currentProfile.uid));
    const unsubFollows = onSnapshot(qFollows, (snap) => {
      const list: Follow[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Follow));
      setFollows(list);
    }, (err) => {
      console.error("Failed to sync follows:", err);
    });

    // 8. Fetch comments for visible posts
    const unsubComments = onSnapshot(collection(db, "comments"), (snap) => {
      const list: PostComment[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as PostComment));
      setComments(list);
    }, (err) => {
      console.error("Failed to sync comments:", err);
    });

    // 9. Fetch real-time security alerts
    const qNotifications = buildQuery(collection(db, "notifications"), where("userId", "==", currentProfile.uid));
    const unsubNotifications = onSnapshot(qNotifications, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setSecurityAlerts(list);

      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const notifData = change.doc.data();
          if (notifData.createdAt > Date.now() - 10000) {
            showNotificationToast(`🚨 ${notifData.title || "Security Alert"}: ${notifData.text}`);
          }
        }
      });
    }, (err) => {
      console.error("Failed to sync notifications:", err);
    });

    return () => {
      unsubKitchens();
      if (unsubDetails) {
        (unsubDetails as () => void)();
      }
      unsubMenu();
      unsubFeed();
      unsubOrders();
      unsubReviews();
      unsubFavorites();
      unsubFollows();
      unsubComments();
      unsubNotifications();
    };
  }, [currentProfile.uid]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2500);
  };

  // Double tap post to Like (optimistic UI for immediate feedback)
  const handleDoubleTapPost = async (postId: string) => {
    setDoubleTappedPostId(postId);
    setTimeout(() => setDoubleTappedPostId(null), 800);

    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;

    const previousLikes = Array.isArray(post.likes) ? [...post.likes] : [];
    let updatedLikes = [...previousLikes];
    if (updatedLikes.includes(currentProfile.uid)) {
      // Unlike
      updatedLikes = updatedLikes.filter(id => id !== currentProfile.uid);
      setLikedPosts(prev => ({ ...prev, [postId]: false }));
    } else {
      // Like
      updatedLikes.push(currentProfile.uid);
      setLikedPosts(prev => ({ ...prev, [postId]: true }));
    }

    // Optimistic local update so heart fills immediately
    setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: updatedLikes } : p));

    try {
      await updateDoc(doc(db, "feed_posts", postId), { likes: updatedLikes });
    } catch (err) {
      console.error("Failed to update post likes:", err);
      // Roll back on failure
      setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: previousLikes } : p));
      setLikedPosts(prev => ({ ...prev, [postId]: previousLikes.includes(currentProfile.uid) }));
    }
  };


  // Admin toggle AI Sparkle Tag
  const handleToggleAiSparkle = async (postId: string, currentStatus: boolean) => {
    if (currentProfile.role !== "admin") return;
    try {
      await updateDoc(doc(db, "feed_posts", postId), {
        aiSparkleImposed: !currentStatus
      });
      showToast(`AI Sparkle Tag updated for post! ✨`);
    } catch (err) {
      console.error("Failed to toggle AI Sparkle:", err);
      showToast("Error updating AI Sparkle Tag.");
    }
  };

  const toggleFollowKitchen = async (kitchenId: string) => {
    const followId = `follow_${currentProfile.uid}_${kitchenId}`;
    const alreadyFollowing = follows.some(f => f.kitchenId === kitchenId);
    const previousFollows = follows;

    // Optimistic follow/unfollow for immediate button feedback
    if (alreadyFollowing) {
      setFollows(prev => prev.filter(f => f.kitchenId !== kitchenId));
      showToast("Unfollowed kitchen.");
    } else {
      setFollows(prev => [
        ...prev,
        {
          id: followId,
          followerId: currentProfile.uid,
          kitchenId,
          createdAt: Date.now(),
        },
      ]);
      showToast("Following kitchen.");
    }

    try {
      if (alreadyFollowing) {
        await deleteDoc(doc(db, "follows", followId));
      } else {
        await setDoc(doc(db, "follows", followId), {
          id: followId,
          followerId: currentProfile.uid,
          kitchenId,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Failed to toggle follow:", err);
      setFollows(previousFollows);
      showToast("Failed to update follow state.");
    }
  };


  const openCommentsForPost = (postId: string) => {
    setSelectedCommentPostId(postId);
    setCommentDraft("");
  };

  const closeCommentsDrawer = () => {
    setSelectedCommentPostId(null);
    setCommentDraft("");
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommentPostId) return;
    const text = commentDraft.trim();
    if (!text) return;

    const post = feedPosts.find(p => p.id === selectedCommentPostId);
    if (!post) return;

    try {
      const commentId = `comment_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await setDoc(doc(db, "comments", commentId), {
        id: commentId,
        postId: selectedCommentPostId,
        userId: currentProfile.uid,
        userName: currentProfile.displayName || "User",
        userRole: currentProfile.role,
        text,
        createdAt: Date.now(),
        kitchenId: post.kitchenId
      });
      setComments(prev => [...prev, {
        id: commentId,
        postId: selectedCommentPostId,
        userId: currentProfile.uid,
        userName: currentProfile.displayName || "User",
        userRole: currentProfile.role,
        text,
        createdAt: Date.now(),
        kitchenId: post.kitchenId
      }]);
      setCommentDraft("");
      showToast("Comment posted.");
    } catch (err) {
      console.error("Failed to post comment:", err);
      const msg = err instanceof Error ? err.message : "Failed to post comment.";
      showToast(msg);
    }
  };

  // Add item to cart
  const addToCart = (item: MenuItem, kitchenId: string, selectedAddOns?: SelectedAddOn[]) => {
    // Check if adding from a different kitchen. If so, alert and clear cart.
    const firstCartItem = getCartList()[0];
    if (firstCartItem && firstCartItem.kitchenId !== kitchenId) {
      if (window.confirm("You already have items from another kitchen in your cart. Clear cart and add this item?")) {
        setCart({});
      } else {
        return;
      }
    }

    // If item has customizable add-ons and none were passed, open the customizer!
    if (item.addOnGroups && item.addOnGroups.length > 0 && !selectedAddOns) {
      setAddOnSelectionItem(item);
      const initialSelections: Record<string, string[]> = {};
      item.addOnGroups.forEach(g => {
        if (g.maxSelections === 1 && g.options.length > 0) {
          initialSelections[g.id] = [g.options[0].id];
        } else {
          initialSelections[g.id] = [];
        }
      });
      setAddOnSelections(initialSelections);
      return;
    }

    const addOns = selectedAddOns || [];
    const addOnsKey = addOns.length > 0 
      ? "_" + addOns.map(ao => ao.optionId).sort().join("-")
      : "";
    const cartKey = `${item.id}${addOnsKey}`;

    setCart(prev => {
      const existing = prev[cartKey];
      if (existing) {
        return {
          ...prev,
          [cartKey]: { ...existing, quantity: existing.quantity + 1 }
        };
      }
      return {
        ...prev,
        [cartKey]: { item, quantity: 1, kitchenId, selectedAddOns: addOns }
      };
    });

    showToast(`Added ${item.name} to cart!`);
  };

  const updateCartQuantity = (cartKey: string, delta: number) => {
    setCart(prev => {
      const existing = prev[cartKey];
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[cartKey];
        return copy;
      }
      return {
        ...prev,
        [cartKey]: { ...existing, quantity: newQty }
      };
    });
  };

  // Place Order Transaction
  const handlePlaceOrder = async () => {
    if (currentProfile.status === "Pending_Verification") {
      showToast("⚠️ Cannot place orders. Your profile is Pending MyGate Verification by a Trustee Admin.");
      return;
    }

    const cartList = getCartList();
    if (cartList.length === 0) return;

    const kitchenId = cartList[0].kitchenId;
    const kitchen = kitchens.find(k => k.uid === kitchenId);
    if (!kitchen) return;

    const subtotal = cartList.reduce((sum, entry) => {
      const addOnsTotal = entry.selectedAddOns?.reduce((s, ao) => s + ao.price, 0) || 0;
      return sum + ((entry.item.price + addOnsTotal) * entry.quantity);
    }, 0);
    // MOV and coverage logic: if below MOV OR outside delivery coverage, automatically toggle to 'pickup' self pickup order type
    const deliversToCustomer = checkKitchenDelivers(kitchen);
    const deliveryType = (subtotal >= kitchen.mov && deliversToCustomer) ? "delivery" : "pickup";

    // Generate secret 4 digit delivery code PIN
    const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();

    const orderData = {
      customerId: currentProfile.uid,
      customerName: currentProfile.displayName || "Customer",
      customerPhone: currentProfile.phone || "",
      customerAddress: currentProfile.flatAddress || "",
      kitchenId,
      kitchenName: kitchen.kitchenName,
      items: cartList.map(entry => ({
        itemId: entry.item.id,
        name: entry.item.name,
        price: entry.item.price,
        quantity: entry.quantity,
        selectedAddOns: entry.selectedAddOns || []
      })),
      subtotal,
      total: subtotal,
      deliveryType,
      status: "PENDING" as const,
      deliveryPin,
      scheduledTime: scheduleMode === "later" ? (scheduledTime || "Not Specified") : "",
      createdAt: new Date().toISOString()
    };

    try {
      const orderId = "order_" + Date.now();
      const finalOrderData = {
        id: orderId,
        ...orderData
      };
      await setDoc(doc(db, "orders", orderId), finalOrderData);
      
      // Clear cart
      setCart({});
      setScheduleMode("asap");
      setScheduledTime("");
      setSelectedOrderId(orderId);
      setActiveTab("orders");
      showToast("Order placed successfully! 🎉");
    } catch (err) {
      console.error("Error creating order:", err);
      showToast("Failed to place order. Try again.");
    }
  };

  const copyPinToClipboard = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  // Calculate cart quantities
  const totalCartQty = getCartList().reduce((sum, entry) => sum + entry.quantity, 0);
  const activeCartKitchenId = getCartList()[0]?.kitchenId;
  const activeCartKitchen = kitchens.find(k => k.uid === activeCartKitchenId);
  const cartSubtotal = getCartList().reduce((sum, entry) => {
    const addOnsPrice = entry.selectedAddOns?.reduce((s, ao) => s + ao.price, 0) || 0;
    return sum + ((entry.item.price + addOnsPrice) * entry.quantity);
  }, 0);
  const visibleFeedPosts = [...feedPosts]
    .map((post) => {
      const kitchen = kitchens.find(k => k.uid === post.kitchenId);
      const followBoost = followKitchenIds.has(post.kitchenId) ? 1000000000 : 0;
      const createdAtMs = typeof post.createdAt === "number" ? post.createdAt : 0;
      return { post, kitchen, score: followBoost + createdAtMs };
    })
    .filter(({ kitchen }) => {
      // If kitchen data isn't loaded yet, show the post anyway (prevents race condition)
      if (!kitchen) return true;
      // Show posts from same society OR kitchens that deliver to the customer
      const sameSociety = (kitchen.society || "") === (currentProfile.society || "");
      const deliversHere = checkKitchenDelivers(kitchen);
      if (!sameSociety && !deliversHere) return false;
      if (vegFilter === "veg" && kitchen.vegType !== "veg") return false;
      if (vegFilter === "non-veg" && kitchen.vegType === "veg") return false;
      return true;
    })
    .sort((a, b) => b.score - a.score);

  const visibleDirectoryKitchens = kitchens.filter((kitchen) => {
    if (!kitchen) return false;
    const deliversToCustomer = checkKitchenDelivers(kitchen);
    const kitchenSociety = kitchen.society || "";
    const matchSociety = kitchenSociety === currentProfile.society || deliversToCustomer;

    const kitchenName = kitchen.kitchenName || "";
    const cuisineType = kitchen.cuisineType || "";
    const matchSearch = kitchenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        cuisineType.toLowerCase().includes(searchQuery.toLowerCase());

    const vegType = kitchen.vegType || "both";
    const matchVeg = vegFilter === "all" ? true :
                     vegFilter === "veg" ? vegType === "veg" :
                     (vegType === "non-veg" || vegType === "both");

    return matchSociety && matchSearch && matchVeg;
  });

  const activeComments = comments.filter(c => c.postId === selectedCommentPostId);


  return (
    <div data-testid="customer-dashboard" className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-800 dark:text-slate-100 pb-20 transition-colors duration-200">
      {/* Toast Overlay */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-2xl shadow-lg z-50 flex items-center gap-2 animate-scale-up">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Real-time Order Stacking Notifications */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className="pointer-events-auto w-full p-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow-xl border border-indigo-500/30 flex items-start gap-3 animate-scale-up"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500 flex items-center justify-center text-lg shrink-0">
              🔔
            </div>
            <div className="flex-1 space-y-0.5">
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Order Status Alert</p>
              <p className="text-xs font-semibold leading-snug">{notif.message}</p>
            </div>
            <button
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
              className="text-gray-400 hover:text-white text-xs p-1 shrink-0 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="sticky top-0 bg-background-secondary/95 backdrop-blur-md border-b border-border-primary px-6 py-4 flex items-center justify-between z-30 shadow-theme">
        <div 
          onClick={() => {
            setSelectedKitchenId(null);
            setSelectedOrderId(null);
            setActiveTab("feed");
          }}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-all"
          title="Go to Home Feed"
        >
          <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center font-black text-white text-lg tracking-wider shadow-sm">
            CP
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-text-primary uppercase">CP-Eats Customer</h1>
            <p className="text-[10px] text-text-muted font-bold">📍 {currentProfile.flatAddress.split(",")[0] || "Centurian Park"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {showAdminBtn && (
            <button
              onClick={onOpenAdmin}
              className="px-2.5 py-1.5 bg-brand-primary-container hover:bg-brand-primary-container/80 text-brand-primary text-[10px] font-black rounded-lg border border-brand-primary/10 transition-all uppercase tracking-wider cursor-pointer shadow-xs"
            >
              Moderation Panel
            </button>
          )}

          <button
            data-testid="theme-toggle"
            onClick={handleToggleTheme}
            className="p-2 text-text-muted hover:text-brand-primary transition-colors cursor-pointer"
            title={themePreference === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {themePreference === "dark" ? (
              <Sun className="w-5 h-5 text-amber-500" />
            ) : (
              <Moon className="w-5 h-5 text-text-secondary" />
            )}
          </button>

          <button
            data-testid="logout-button"
            onClick={onLogout}
            className="p-2 text-text-muted hover:text-rose-500 transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Pending MyGate verification notice banner */}
      {currentProfile.status === "Pending_Verification" && (
        <div id="pending-verification-banner" className="bg-amber-50 border-b border-amber-200/55 px-6 py-3 flex items-center gap-3 text-amber-800">
          <div className="p-1 rounded-md bg-amber-100 text-amber-600">
            <span className="text-sm">⚠️</span>
          </div>
          <div className="flex-1 text-[11px] leading-normal font-bold">
            <span className="font-extrabold">MyGate Verification Pending:</span> Your resident profile is currently undergoing verification by a Trustee Admin. You can view dishes and add to cart, but placing orders is barred until approved.
          </div>
        </div>
      )}

      {/* Security Alerts Banner */}
      {securityAlerts.length > 0 && (
        <div id="security-alerts-banner-list" className="bg-rose-50 border-b border-rose-200/55 px-6 py-3 space-y-2">
          {securityAlerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-3 text-rose-950">
              <div className="p-1.5 rounded-md bg-rose-100 text-rose-600 mt-0.5 shrink-0 animate-pulse">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex-1 text-[11px] leading-relaxed font-bold">
                <span className="font-extrabold uppercase tracking-wide block text-rose-700 text-[10px] mb-0.5">⚠️ {alert.title}</span>
                {alert.text}
              </div>
              <button
                onClick={() => dismissSecurityAlert(alert.id)}
                className="text-[10px] bg-rose-100 hover:bg-rose-200/70 px-2.5 py-1 rounded-md text-rose-800 font-extrabold transition-all cursor-pointer self-center"
              >
                Dismiss Alert
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Render Area */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-5 space-y-6">
        
        {/* TAB 1: Discover Feed */}
        {activeTab === "feed" && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-text-primary">Neighborhood Feed</h2>
              <p className="text-xs text-text-muted">Authentic culinary creations from your verified neighbors</p>
            </div>

            {/* Veg Filter Buttons */}
            <div className="flex gap-1.5">
              {(["all", "veg", "non-veg"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setVegFilter(type)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                    vegFilter === type
                      ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                      : "bg-background-secondary text-text-muted border-border-primary hover:border-brand-primary/40"
                  }`}
                >
                  {type === "all" ? "All Kitchens" : type === "veg" ? "Pure Veg 🟢" : "Non-Veg Only 🔴"}
                </button>
              ))}
            </div>

            {/* Past Meals Visual Reorder Feed */}
            <PastMealsReorder
              orders={orders}
              onReorder={handleReorder}
              onViewHistory={() => {
                setActiveTab("orders");
                setSelectedOrderId(null);
              }}
            />

            {feedPosts.length === 0 ? (
              <div className="text-center py-12 bg-background-secondary rounded-3xl border border-border-primary shadow-theme">
                <Coffee className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-sm font-bold text-text-primary">No food feed posts yet</p>
                <p className="text-xs text-text-muted mt-1 font-semibold">Check back later for fresh homemade updates!</p>
              </div>
            ) : visibleFeedPosts.length === 0 ? (
              <div className="text-center py-12 bg-background-secondary rounded-3xl border border-border-primary shadow-theme">
                <Coffee className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-sm font-bold text-text-primary">No posts match your filters</p>
                <p className="text-xs text-text-muted mt-1 font-semibold">
                  Try switching veg filter to All, or check kitchens that deliver to your block.
                </p>
              </div>
            ) : (
              visibleFeedPosts.map(({ post, kitchen }) => {
                if (!kitchen) return null;
                const isLiked = (Array.isArray(post.likes) && post.likes.includes(currentProfile.uid)) || likedPosts[post.id];
                const commentCount = comments.filter(c => c.postId === post.id).length;

                return (
                  <FeedPostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentProfile.uid}
                    isLiked={!!isLiked}
                    kitchen={kitchen}
                    menuItems={menuItems}
                    doubleTappedPostId={doubleTappedPostId}
                    onDoubleTap={handleDoubleTapPost}
                    onAddToCart={addToCart}
                    onSelectKitchen={setSelectedKitchenId}
                    onSelectTab={setActiveTab}
                    isAdmin={currentProfile.role === "admin"}
                    onToggleAiSparkle={handleToggleAiSparkle}
                    currentUserRole={currentProfile.role}
                    commentCount={commentCount}
                    isFollowed={followKitchenIds.has(post.kitchenId)}
                    onToggleFollow={toggleFollowKitchen}
                    onOpenComments={openCommentsForPost}
                  />
                );
              })
            )}

          </div>
        )}

        {/* TAB 2: Kitchens Directory */}
        {activeTab === "directory" && !selectedKitchenId && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-text-primary">Kitchen Directory</h2>
              <p className="text-xs text-text-muted">Order trusted homemade gourmet from different blocks</p>
            </div>

            {/* Filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search kitchens or food categories..."
                  className="w-full pl-10 pr-4 py-2.5 bg-background-secondary border border-border-primary rounded-2xl text-sm text-text-primary focus:ring-2 focus:ring-brand-primary shadow-xs focus:outline-hidden transition-all"
                />
              </div>

              {/* Veg Toggle Buttons */}
              <div className="flex gap-1.5">
                {(["all", "veg", "non-veg"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setVegFilter(type)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                      vegFilter === type
                        ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                        : "bg-background-secondary text-text-muted border-border-primary hover:border-brand-primary/40"
                    }`}
                  >
                    {type === "all" ? "All Kitchens" : type === "veg" ? "Pure Veg 🟢" : "Non-Veg Only 🔴"}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="space-y-4">
              {kitchens.length === 0 ? (
                <div className="text-center py-12 bg-background-secondary rounded-3xl border border-border-primary shadow-theme">
                  <Coffee className="w-12 h-12 text-text-muted mx-auto mb-3" />
                  <p className="text-sm font-bold text-text-primary">No kitchens listed yet</p>
                  <p className="text-xs text-text-muted mt-1 font-semibold">Verified home kitchens will appear here once they join CP-Eats.</p>
                </div>
              ) : visibleDirectoryKitchens.length === 0 ? (
                <div className="text-center py-12 bg-background-secondary rounded-3xl border border-border-primary shadow-theme">
                  <Coffee className="w-12 h-12 text-text-muted mx-auto mb-3" />
                  <p className="text-sm font-bold text-text-primary">No kitchens match your filters</p>
                  <p className="text-xs text-text-muted mt-1 font-semibold">
                    Try clearing search or switching veg filter. Society: {currentProfile.society || "not set"}
                  </p>
                </div>
              ) : null}
              {visibleDirectoryKitchens
                .map((kitchen) => {

                  if (!kitchen) return null;
                  const isOnline = kitchen.operatingMode ? kitchen.operatingMode === "online" : kitchen.isOnline;
                  const deliversToCustomer = checkKitchenDelivers(kitchen);
                  const vegType = kitchen.vegType || "both";
                  const cuisineType = kitchen.cuisineType || "Homemade Food";
                  const kitchenName = kitchen.kitchenName || "Unknown Kitchen";
                  const society = kitchen.society || "";
                  const isFollowedKitchen = followKitchenIds.has(kitchen.uid);
                  
                  return (
                    <div
                      key={kitchen.uid}
                      onClick={() => {
                        setSelectedKitchenId(kitchen.uid);
                        setSelectedOrderId(null);
                      }}
                      className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme hover:border-brand-primary/40 transition-all cursor-pointer flex justify-between items-center group animate-fade-in"
                    >
                      <div className="space-y-2 pr-4 truncate flex-1">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-background-primary border border-border-primary overflow-hidden shrink-0 flex items-center justify-center">
                            {kitchen.profileImageUrl ? (
                              <img src={kitchen.profileImageUrl} alt={kitchen.kitchenName} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-black text-text-muted">🍳</span>
                            )}
                          </div>
                          {isOnline ? (
                            <span className="flex h-2.5 w-2.5 relative shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                          ) : (
                            <span className="h-2.5 w-2.5 rounded-full bg-background-primary border border-border-primary shrink-0"></span>
                          )}
                          <h3 className="font-extrabold text-sm text-text-primary group-hover:text-brand-primary transition-colors truncate">
                            {kitchenName}
                          </h3>
                          {kitchen.handle && (
                            <span className="text-[9px] font-mono text-text-muted">@{kitchen.handle}</span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest shrink-0 ${
                            vegType === "veg" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : vegType === "non-veg" ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                          }`}>
                            {vegType}
                          </span>
                        </div>

                        <p className="text-xs text-text-muted font-semibold truncate">{cuisineType}</p>
                        
                        <div className="flex items-center gap-2 text-[10px] text-text-secondary font-bold">
                          <span className="px-1.5 py-0.5 bg-background-primary rounded-md border border-border-primary font-mono text-text-muted">
                            MOV: ₹{kitchen.mov ?? 0}
                          </span>
                          <span>•</span>
                          <span className="text-[10px] text-text-muted truncate">
                            📍 {society.replace("Centurian Park - ", "") || "Centurian Park"}
                          </span>
                        </div>

                        {/* Delivery Status indicator line */}
                        <div className="text-[10px] font-extrabold">
                          {deliversToCustomer ? (
                            <span className="text-emerald-600 flex items-center gap-1">
                              🚚 Delivers to your block!
                            </span>
                          ) : (
                            <span className="text-amber-600 flex items-center gap-1">
                              🚗 Self-Pickup Only (No delivery)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right ml-2">
                        {currentProfile.role !== "kitchen" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleFollowKitchen(kitchen.uid);
                            }}
                            className={`mb-2 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                              isFollowedKitchen
                                ? "bg-brand-primary text-white border-brand-primary"
                                : "bg-background-primary text-brand-primary border-brand-primary/20 hover:border-brand-primary"
                            }`}
                          >
                            {isFollowedKitchen ? "Following" : "Follow"}
                          </button>
                        )}
                        {isOnline ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full font-extrabold uppercase text-[8px] tracking-wider border border-emerald-100">
                            Accepting Orders
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-background-primary text-text-muted rounded-full font-extrabold uppercase text-[8px] tracking-wider border border-border-primary">
                            Resting
                          </span>
                        )}
                        <p className="text-[9px] text-text-muted font-extrabold mt-1.5">View Menu →</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Individual Kitchen Menu Page View */}
        {activeTab === "directory" && selectedKitchenId && (
          (() => {
            const kitchen = kitchens.find(k => k.uid === selectedKitchenId);
            const isOnline = kitchen?.operatingMode === "online";
            
            // Filter kitchen items based on user preferences (Veg/Non-Veg, Gluten-Free, Nut-Free)
            const kItems = menuItems
              .filter(item => item.kitchenId === selectedKitchenId)
              .filter(item => {
                if (menuVegFilter === "veg" && !item.isVeg) return false;
                if (menuVegFilter === "non-veg" && item.isVeg) return false;
                if (menuGlutenFreeFilter && !item.isGlutenFree) return false;
                if (menuNutFreeFilter && !item.isNutFree) return false;
                return true;
              });
            const kReviews = reviews.filter(r => r.kitchenId === selectedKitchenId);
            const averageRating = kReviews.length > 0
              ? (kReviews.reduce((sum, r) => sum + r.rating, 0) / kReviews.length).toFixed(1)
              : "0.0";

            if (!kitchen) return <p className="text-xs text-text-muted">Kitchen profile not found.</p>;

            return (
              <div className="space-y-6 animate-scale-up">
                {/* Back button */}
                <button
                  onClick={() => setSelectedKitchenId(null)}
                  className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-brand-primary font-bold transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to directory</span>
                </button>

                {/* Kitchen Detail Banner */}
                <div className={`p-6 rounded-3xl border border-border-primary bg-background-secondary relative overflow-hidden space-y-4 shadow-theme ${!isOnline ? "filter grayscale opacity-75" : ""}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-background-primary border border-border-primary overflow-hidden shrink-0 flex items-center justify-center">
                        {kitchen.profileImageUrl ? (
                          <img src={kitchen.profileImageUrl} alt={kitchen.kitchenName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs">🍳</span>
                        )}
                      </div>
                      <h2 className="text-xl font-black text-text-primary tracking-tight">{kitchen.kitchenName}</h2>
                      <span className="text-xs px-2.5 py-0.5 bg-brand-primary-container text-brand-primary rounded-md font-black uppercase border border-brand-primary/10">{kitchen.vegType}</span>
                    </div>
                    {kitchen.handle && (
                      <p className="text-[10px] font-mono text-text-muted">@{kitchen.handle}</p>
                    )}
                    <p className="text-xs text-text-muted font-bold">{kitchen.cuisineType}</p>
                    
                    {/* Star Rating component under chef cuisine type */}
                    <div className="flex items-center gap-1.5 text-xs py-0.5">
                      <div className="flex items-center text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className="w-3.5 h-3.5 fill-current" 
                            fill={i < Math.round(parseFloat(averageRating)) ? "currentColor" : "none"} 
                          />
                        ))}
                      </div>
                      <span className="font-extrabold text-text-primary font-mono">{averageRating}</span>
                      <span className="text-text-muted font-bold">({kReviews.length} resident reviews)</span>
                    </div>

                    <div className="text-[10px] font-mono text-text-muted flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{kitchen.flatAddress || kitchen.society?.replace("Centurian Park - ", "") || "Centurian Park"}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border-primary flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Min. Delivery Limit</p>
                      <p className="font-mono font-bold text-text-primary">₹{kitchen.mov}</p>
                    </div>
                    <div>
                      {isOnline ? (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full font-extrabold uppercase text-[10px] tracking-wider">
                          Active Kitchen
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full font-extrabold uppercase text-[10px] tracking-wider flex items-center gap-1">
                          🕒 RESTING
                        </span>
                      )}
                    </div>
                  </div>

                  {!isOnline && (
                    <div className="p-3 bg-text-primary text-text-inverse rounded-2xl text-xs flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="font-semibold text-[10px]">🕒 Kitchen is resting right now. Menu ordering and checkout are resting.</p>
                    </div>
                  )}
                </div>

                {/* Dietary Filters Bar */}
                <div className="p-4 bg-background-secondary border border-border-primary rounded-3xl space-y-3 shadow-theme">
                  <h4 className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest pl-1">Filter Dietary Preferences</h4>
                  
                  <div className="flex flex-wrap gap-2">
                    {/* Veg filter toggles */}
                    <div className="flex gap-1 bg-background-primary p-1 rounded-xl border border-border-primary">
                      {(["all", "veg", "non-veg"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setMenuVegFilter(type)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            menuVegFilter === type
                              ? "bg-brand-primary text-white shadow-xs"
                              : "text-text-muted hover:text-brand-primary"
                          }`}
                        >
                          {type === "all" ? "All" : type === "veg" ? "Veg 🟢" : "Non-Veg 🔴"}
                        </button>
                      ))}
                    </div>

                    {/* Gluten-free toggle */}
                    <button
                      onClick={() => setMenuGlutenFreeFilter(!menuGlutenFreeFilter)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                        menuGlutenFreeFilter
                          ? "bg-amber-50 text-amber-700 border-amber-200 font-extrabold"
                          : "bg-background-secondary text-text-muted border-border-primary hover:border-brand-primary/40"
                      }`}
                    >
                      <span>🌾 Gluten-Free</span>
                      {menuGlutenFreeFilter && <Check className="w-3.5 h-3.5 text-amber-600" />}
                    </button>

                    {/* Nut-free toggle */}
                    <button
                      onClick={() => setMenuNutFreeFilter(!menuNutFreeFilter)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                        menuNutFreeFilter
                          ? "bg-blue-50 text-blue-700 border-blue-200 font-extrabold"
                          : "bg-background-secondary text-text-muted border-border-primary hover:border-brand-primary/40"
                      }`}
                    >
                      <span>🥜 Nut-Free</span>
                      {menuNutFreeFilter && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  </div>
                </div>

                {/* Menu items list */}
                <div className="space-y-4">
                  <h3 className="font-black text-xs text-text-muted uppercase tracking-widest pl-2">Available Menu Dishes</h3>
                  {kItems.map((item) => {
                    const hasAddOns = item.addOnGroups && item.addOnGroups.length > 0;
                    
                    // Count total items of this type in the cart
                    const cartEntries = getCartList().filter(entry => entry.item.id === item.id);
                    const qtyInCart = cartEntries.reduce((sum, entry) => sum + entry.quantity, 0);
                    
                    // For non-addons items, retrieve the standard single-key cart entry
                    const cartEntryNoAddOns = cart[item.id];

                    return (
                      <div
                        key={item.id}
                        className={`p-4 bg-background-secondary border border-border-primary rounded-3xl flex justify-between items-center shadow-theme transition-all ${!isOnline ? "opacity-70" : ""}`}
                      >
                        <div className="flex items-center gap-3 pr-4 truncate flex-1">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-14 h-14 object-cover rounded-xl border border-border-primary shrink-0 cursor-zoom-in hover:opacity-90 active:scale-95 transition-all"
                              onClick={() => setEnlargedImage(item.imageUrl)}
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div className="space-y-1.5 truncate flex-1">
                            <div className="flex items-center justify-between gap-2 pr-2">
                              <div className="flex items-center gap-2 truncate">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                                <h4 className="font-extrabold text-xs text-text-primary truncate">{item.name}</h4>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(item);
                                }}
                                className="p-1 rounded-full text-rose-500 hover:bg-rose-50 transition-all cursor-pointer shrink-0"
                                title={favorites.some(f => f.menuItemId === item.id) ? "Remove from Favorites" : "Add to Favorites"}
                              >
                                <Heart 
                                  className="w-4 h-4 transition-transform active:scale-125" 
                                  fill={favorites.some(f => f.menuItemId === item.id) ? "currentColor" : "none"} 
                                />
                              </button>
                            </div>
                            <p className="text-[11px] text-text-muted truncate leading-snug font-semibold">{item.description}</p>
                            {/* Dietary badges line */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.isVeg ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase border border-emerald-100">
                                  🟢 Veg
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[9px] font-bold uppercase border border-rose-100">
                                  🔴 Non-Veg
                                </span>
                              )}
                              {item.isGlutenFree && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold uppercase border border-amber-100">
                                  🌾 Gluten-Free
                                </span>
                              )}
                              {item.isNutFree && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold uppercase border border-blue-100">
                                  🥜 Nut-Free
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-xs text-text-primary font-extrabold">₹{item.price}</p>
                            {item.addOnGroups && item.addOnGroups.length > 0 && (
                              <span className="text-[9px] text-brand-primary bg-brand-primary-container border border-brand-primary/20 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                Customizable
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Cart Controller buttons */}
                        <div className="shrink-0">
                          {hasAddOns ? (
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => addToCart(item, selectedKitchenId)}
                                disabled={!isOnline}
                                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-background-primary disabled:text-text-muted text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex flex-col items-center"
                              >
                                <span>Add +</span>
                                <span className="text-[8px] font-bold opacity-80 uppercase tracking-widest">Customizable</span>
                              </button>
                              {qtyInCart > 0 && (
                                <span className="text-[10px] text-brand-primary font-bold">
                                  ({qtyInCart} in cart)
                                </span>
                              )}
                            </div>
                          ) : cartEntryNoAddOns ? (
                            <div className="flex items-center gap-2 border border-brand-primary/20 rounded-xl bg-brand-primary-container p-1">
                              <button
                                onClick={() => updateCartQuantity(item.id, -1)}
                                className="w-7 h-7 rounded-lg bg-background-secondary border border-brand-primary/10 hover:bg-brand-primary/10 text-brand-primary font-extrabold text-sm flex items-center justify-center cursor-pointer transition-all"
                              >
                                -
                              </button>
                              <span className="text-xs font-black text-brand-primary px-1">{cartEntryNoAddOns.quantity}</span>
                              <button
                                onClick={() => updateCartQuantity(item.id, 1)}
                                className="w-7 h-7 rounded-lg bg-background-secondary border border-brand-primary/10 hover:bg-brand-primary/10 text-brand-primary font-extrabold text-sm flex items-center justify-center cursor-pointer transition-all"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item, selectedKitchenId)}
                              disabled={!isOnline}
                              className="px-3.5 py-1.5 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-background-primary disabled:text-text-muted text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Handpicked Review Wall */}
                {(() => {
                  const featuredReviews = reviews.filter(
                    (r) => r.kitchenId === selectedKitchenId && r.isHandpicked === true
                  );

                  if (featuredReviews.length === 0) return null;

                  return (
                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 pl-2">
                        <span className="text-base">⭐</span>
                        <h3 className="font-black text-xs text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                          Chef's Handpicked Reviews
                        </h3>
                      </div>

                      <div className="space-y-4">
                        {featuredReviews.map((rev) => (
                          <div
                            key={rev.id}
                            className="p-5 bg-gradient-to-br from-indigo-50/50 to-slate-50 dark:from-slate-900/60 dark:to-slate-950 border border-indigo-100/60 dark:border-slate-800 rounded-3xl space-y-3"
                          >
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-extrabold text-indigo-950 dark:text-indigo-300">{rev.customerName}</span>
                              <div className="flex gap-0.5 text-amber-400">
                                {Array.from({ length: rev.rating }).map((_, i) => (
                                  <Star key={i} className="w-3.5 h-3.5 fill-current" />
                                ))}
                              </div>
                            </div>

                            <p className="text-xs text-gray-700 dark:text-slate-300 italic leading-relaxed">
                              "{rev.comment}"
                            </p>

                            {/* Tagged food items in review */}
                            {rev.taggedItemIds && rev.taggedItemIds.length > 0 && (
                              <div className="space-y-1.5 pt-2 border-t border-indigo-100/40 dark:border-slate-800/80">
                                <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
                                  Tagged Dishes:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {rev.taggedItemIds.map((tid: string) => {
                                    const dish = menuItems.find((mi) => mi.id === tid);
                                    if (!dish) return null;

                                    return (
                                      <button
                                        key={tid}
                                        onClick={() => {
                                          addToCart(dish, selectedKitchenId);
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 text-[10px] font-bold rounded-full transition-all shadow-3xs cursor-pointer"
                                        title="Quick Add to Cart!"
                                      >
                                        <span>🟢 {dish.name}</span>
                                        <span className="text-gray-400 dark:text-slate-400 font-normal">₹{dish.price}</span>
                                        <span className="text-indigo-500 dark:text-indigo-400 font-black text-[12px] pl-1 leading-none">+</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Verified Neighborhood Reviews Section */}
                {(() => {
                  const kitchenReviews = reviews.filter(
                    (r) => r.kitchenId === selectedKitchenId
                  );

                  // Calculate Average Rating
                  const averageRating = kitchenReviews.length > 0
                    ? (kitchenReviews.reduce((sum, r) => sum + r.rating, 0) / kitchenReviews.length).toFixed(1)
                    : "0.0";

                  return (
                    <div className="space-y-4 pt-6 border-t border-border-primary">
                      <div className="flex items-center justify-between pl-2">
                        <div className="space-y-1">
                          <h3 className="font-black text-xs text-text-muted uppercase tracking-widest">
                            Verified Neighborhood Reviews
                          </h3>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-text-primary font-mono">{averageRating} ⭐</span>
                            <span className="text-[10px] text-text-muted font-bold">({kitchenReviews.length} resident reviews)</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 text-[8px] font-black uppercase rounded-md tracking-widest flex items-center gap-1">
                            <span>🔐 PIN VERIFIED</span>
                          </span>
                        </div>
                      </div>

                      {/* Trust Seal explanation */}
                      <div className="p-3.5 bg-brand-primary-container border border-brand-primary/10 rounded-2xl space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-brand-primary" />
                          <h4 className="font-extrabold text-[10px] text-brand-primary uppercase tracking-wider">CP-Eats Trust Seal</h4>
                        </div>
                        <p className="text-[10px] text-brand-primary leading-normal font-semibold">
                          All reviews are dynamically unlocked <strong>ONLY</strong> after a verified physical delivery handshake is confirmed with the secret 4-digit PIN. This prevents fake reviews from family, friends, or outsiders.
                        </p>
                      </div>

                      {kitchenReviews.length === 0 ? (
                        <div className="text-center py-6 bg-background-secondary rounded-2xl border border-border-primary shadow-theme">
                          <p className="text-xs font-bold text-text-muted">No verified resident reviews yet.</p>
                          <p className="text-[9px] text-text-muted mt-0.5">Order and complete delivery to post the very first review!</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {kitchenReviews.map((rev) => (
                            <div
                              key={rev.id}
                              className="p-4 bg-background-secondary border border-border-primary rounded-2xl space-y-2 shadow-theme"
                            >
                              <div className="flex justify-between items-start text-xs">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-text-primary">{rev.customerName}</span>
                                    <span className="text-[9px] font-bold text-text-muted font-mono">
                                      • {new Date(rev.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </span>
                                  </div>
                                  <div className="flex gap-0.5 text-amber-400 mt-1">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star key={i} className="w-3 h-3 fill-current" fill={i < rev.rating ? "currentColor" : "none"} />
                                    ))}
                                  </div>
                                </div>
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[8px] font-extrabold flex items-center gap-0.5">
                                  <span>🔒 Verified Resident</span>
                                </span>
                              </div>

                              {rev.comment ? (
                                <p className="text-xs text-text-secondary leading-relaxed font-semibold">
                                  "{rev.comment}"
                                </p>
                              ) : (
                                <p className="text-xs text-text-muted italic">Rated {rev.rating} stars</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()
        )}

        {selectedCommentPostId && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-lg bg-background-secondary rounded-t-3xl sm:rounded-3xl border border-border-primary shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
              <div className="p-4 border-b border-border-primary flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-text-primary">Comments</h3>
                  <p className="text-[10px] text-text-muted">
                    {comments.find(c => c.postId === selectedCommentPostId)?.postId ? "Post discussion" : "Conversation"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCommentsDrawer}
                  className="p-2 rounded-full bg-background-primary border border-border-primary text-text-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeComments.length === 0 ? (
                  <div className="text-center py-10 text-text-muted text-xs">
                    No comments yet. Be the first to reply.
                  </div>
                ) : (
                  activeComments.map((comment) => (
                    <div key={comment.id} className="p-3 bg-background-primary border border-border-primary rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-text-primary">{comment.userName}</span>
                        <span className="text-[9px] uppercase tracking-wider text-text-muted font-black">{comment.userRole}</span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSubmitComment} className="p-4 border-t border-border-primary bg-background-secondary">
                <div className="flex gap-2">
                  <input
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 px-3 py-2.5 rounded-xl bg-background-primary border border-border-primary text-sm text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-hidden"
                    maxLength={220}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-black uppercase tracking-wider"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: Shopping Cart & Checkout */}
        {activeTab === "cart" && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-text-primary">Active Cart</h2>
              <p className="text-xs text-text-muted">Verify minimum limits and society pickup rules</p>
            </div>

            {totalCartQty === 0 ? (
              <div className="text-center py-12 bg-background-secondary rounded-3xl border border-border-primary shadow-theme">
                <ShoppingBag className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-sm font-bold text-text-primary">Your basket is empty</p>
                <p className="text-xs text-text-muted mt-1 font-semibold">Browse our directory and social food feed to add delicious items!</p>
              </div>
            ) : (
              <div className="space-y-6 animate-scale-up">
                {/* Kitchen Detail Indicator */}
                <div className="p-4 bg-brand-primary-container rounded-2xl border border-brand-primary/10 text-brand-primary flex justify-between items-center text-xs shadow-xs">
                  <div>
                    <p className="text-[10px] text-brand-primary font-black uppercase tracking-wider">Ordering From</p>
                    <p className="font-extrabold text-sm">{activeCartKitchen?.kitchenName}</p>
                  </div>
                  <span className="font-mono bg-background-secondary border border-brand-primary/15 px-2 py-0.5 rounded-md font-extrabold">
                    MOV: ₹{activeCartKitchen?.mov}
                  </span>
                </div>

                {/* Cart list items */}
                <div className="bg-background-secondary rounded-3xl border border-border-primary p-5 divide-y divide-border-primary space-y-4 shadow-theme">
                  {getCartList().map((entry) => {
                    const addOnsPrice = entry.selectedAddOns?.reduce((s, ao) => s + ao.price, 0) || 0;
                    const itemUnitPrice = entry.item.price + addOnsPrice;
                    return (
                      <div key={entry.cartKey} className="flex justify-between items-center py-3 first:pt-0 last:pb-0 text-xs">
                        <div className="space-y-1 pr-3 truncate">
                          <p className="font-extrabold text-text-primary truncate">{entry.item.name}</p>
                          {entry.selectedAddOns && entry.selectedAddOns.length > 0 && (
                            <p className="text-[10px] text-text-muted font-bold whitespace-normal">
                              + {entry.selectedAddOns.map(ao => `${ao.optionName} (+₹${ao.price})`).join(', ')}
                            </p>
                          )}
                          <p className="text-text-muted font-bold">₹{itemUnitPrice} each</p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-2 border border-border-primary rounded-xl p-1 bg-background-primary">
                            <button
                              onClick={() => updateCartQuantity(entry.cartKey, -1)}
                              className="w-6 h-6 rounded-md bg-background-secondary border border-border-primary hover:bg-brand-primary/10 text-text-primary font-extrabold text-xs flex items-center justify-center cursor-pointer transition-all shadow-xs"
                            >
                              -
                            </button>
                            <span className="text-xs font-black text-text-primary px-1">{entry.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(entry.cartKey, 1)}
                              className="w-6 h-6 rounded-md bg-background-secondary border border-border-primary hover:bg-brand-primary/10 text-text-primary font-extrabold text-xs flex items-center justify-center cursor-pointer transition-all shadow-xs"
                            >
                              +
                            </button>
                          </div>

                          <span className="font-mono font-extrabold text-text-primary text-right w-16">
                            ₹{(itemUnitPrice * entry.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* MOV Verification Check */}
                {activeCartKitchen && cartSubtotal < activeCartKitchen.mov ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900 text-amber-950 dark:text-amber-200 flex gap-3 animate-fade-in">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-extrabold text-amber-900 dark:text-amber-400 uppercase tracking-wide">Pickup Threshold Warning</p>
                      <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed font-semibold">
                        Your total (₹{cartSubtotal}) is below this kitchen's ₹{activeCartKitchen.mov} Minimum Order Value for free door delivery. This order will proceed as a <strong>Self-Pickup</strong> order from their flat.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-950 flex gap-3 animate-fade-in">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-extrabold text-emerald-900 uppercase tracking-wide">Free Society Door Delivery</p>
                      <p className="text-[10px] text-emerald-800 leading-relaxed font-semibold">
                        Congratulations! Your order qualifies for free door delivery to your flat by the kitchen's delivery partner.
                      </p>
                    </div>
                  </div>
                )}

                {/* Scheduling Option */}
                <div className="bg-background-secondary border border-border-primary rounded-3xl p-5 space-y-4 shadow-theme">
                  <div>
                    <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Schedule Delivery Time</h4>
                    <p className="text-[10px] text-text-muted font-semibold">Choose when you would like this food to arrive</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <button
                      type="button"
                      onClick={() => setScheduleMode("asap")}
                      className={`py-3 px-4 rounded-2xl text-xs font-black transition-all border text-center cursor-pointer ${
                        scheduleMode === "asap"
                          ? "bg-brand-primary border-brand-primary text-white shadow-xs"
                          : "bg-background-primary border-border-primary text-text-secondary hover:bg-background-primary/80"
                      }`}
                    >
                      🚀 Deliver ASAP
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode("later")}
                      className={`py-3 px-4 rounded-2xl text-xs font-black transition-all border text-center cursor-pointer ${
                        scheduleMode === "later"
                          ? "bg-brand-primary border-brand-primary text-white shadow-xs"
                          : "bg-background-primary border-border-primary text-text-secondary hover:bg-background-primary/80"
                      }`}
                    >
                      🕒 Schedule Later
                    </button>
                  </div>

                  {scheduleMode === "later" && (
                    <div className="space-y-2.5 animate-scale-up">
                      <label className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest block">Select Date and Time</label>
                      <input
                        type="datetime-local"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        required
                        className="w-full px-4 py-3 border border-border-primary bg-background-primary text-text-primary rounded-xl text-xs focus:ring-2 focus:ring-brand-primary focus:outline-hidden"
                      />
                    </div>
                  )}
                </div>

                {/* Order Summary Billing */}
                <div className="bg-background-secondary rounded-3xl border border-border-primary p-5 text-xs space-y-3.5 shadow-theme">
                  <div className="flex justify-between font-bold text-text-secondary">
                    <span>Order Subtotal</span>
                    <span className="font-mono text-text-primary">₹{cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-text-secondary">
                    <span>Delivery Charge</span>
                    <span className="font-mono text-emerald-600 font-extrabold">FREE</span>
                  </div>
                  <div className="flex justify-between font-bold text-text-secondary">
                    <span>Delivery Type</span>
                    <span className="font-bold uppercase bg-background-primary border border-border-primary px-2 py-0.5 rounded-sm text-text-primary">
                      {activeCartKitchen && cartSubtotal < activeCartKitchen.mov ? "Self-Pickup" : "Door Delivery"}
                    </span>
                  </div>
                  <hr className="border-border-primary" />
                  <div className="flex justify-between text-sm font-black text-text-primary">
                    <span>Final Amount Payable</span>
                    <span className="font-mono text-brand-primary">₹{cartSubtotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Place Order CTA Button */}
                {currentProfile.status === "Pending_Verification" ? (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex flex-col items-center gap-1">
                    <p className="text-xs font-bold text-amber-800 text-center">
                      ⚠️ Placing Orders Barred
                    </p>
                    <p className="text-[10px] text-amber-600 text-center font-semibold">
                      Your resident account is pending official MyGate verification by a Trustee Admin.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handlePlaceOrder}
                    className="w-full py-3.5 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-2xl text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Place Society Order</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Active and Past Orders History */}
        {activeTab === "orders" && !selectedOrderId && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-text-primary">My Society Orders</h2>
              <p className="text-xs text-text-muted">Track active deliveries and complete secure validation handshakes</p>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-12 bg-background-secondary rounded-3xl border border-border-primary shadow-theme">
                <Clipboard className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-sm font-bold text-text-primary">No orders tracked</p>
                <p className="text-xs text-text-muted mt-1 font-semibold">When you order from home kitchens, they will register here instantly!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Active Orders */}
                {(() => {
                  const activeOrders = orders.filter(o => !["COMPLETED", "CANCELLED"].includes(o.status));
                  if (activeOrders.length === 0) return null;

                  return (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-brand-primary uppercase tracking-widest pl-1">
                        Active Orders ({activeOrders.length})
                      </h3>
                      <div className="space-y-3">
                        {activeOrders.map((ord) => (
                          <div
                            key={ord.id}
                            onClick={() => setSelectedOrderId(ord.id)}
                            className="p-5 bg-background-secondary rounded-3xl border border-border-primary shadow-theme hover:border-brand-primary/30 transition-all cursor-pointer flex justify-between items-center animate-fade-in"
                          >
                            <div className="space-y-2 pr-4 truncate">
                              <div>
                                <h3 className="font-bold text-xs text-text-primary truncate">
                                  {ord.kitchenName}
                                </h3>
                                <p className="text-[10px] text-text-muted font-bold">
                                  {ord.items.length} dishes • ₹{ord.total}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[9px] bg-background-primary border border-border-primary text-text-secondary px-1.5 py-0.5 rounded-sm font-mono">
                                  {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-[9px] bg-brand-primary-container border border-brand-primary/15 text-brand-primary px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider">
                                  {ord.deliveryType === "pickup" ? "Pickup" : "Delivery"}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 text-right space-y-1.5">
                              <span className="px-2.5 py-1 rounded-full font-extrabold uppercase text-[9px] tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 animate-pulse">
                                {ord.status}
                              </span>
                              <p className="text-[9px] text-gray-400 dark:text-slate-500">Details & Chat →</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Order History (Completed & Cancelled) */}
                {(() => {
                  const pastOrders = orders.filter(o => ["COMPLETED", "CANCELLED"].includes(o.status));
                  if (pastOrders.length === 0) return null;

                  return (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">
                        Order History / Past Deliveries
                      </h3>
                      <div className="space-y-3">
                        {pastOrders.map((ord) => (
                          <div
                            key={ord.id}
                            onClick={() => setSelectedOrderId(ord.id)}
                            className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-850 shadow-3xs hover:shadow-2xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in"
                          >
                            <div className="space-y-2 pr-4 truncate flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-xs text-gray-950 dark:text-slate-100 truncate">
                                  {ord.kitchenName}
                                </h3>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide ${
                                  ord.status === "COMPLETED" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900" : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-400 border border-rose-100 dark:border-rose-900"
                                }`}>
                                  {ord.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-400 dark:text-slate-400 font-medium truncate">
                                {ord.items.map(item => `${item.quantity}x ${item.name}`).join(", ")}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] bg-slate-50 dark:bg-slate-850 border border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded-sm font-mono">
                                  {new Date(ord.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                                <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold font-mono">
                                  ₹{ord.total.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                              {ord.status === "COMPLETED" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReorder(ord);
                                  }}
                                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-xl flex items-center gap-1 shadow-3xs cursor-pointer transition-all uppercase tracking-wider"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Reorder</span>
                                </button>
                              )}
                              <span className="text-[9px] text-gray-400 dark:text-slate-500 hidden sm:inline">Details →</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Active Order Details Page View */}
        {activeTab === "orders" && selectedOrderId && (
          (() => {
            const ord = orders.find(o => o.id === selectedOrderId);
            if (!ord) return <p className="text-xs text-gray-400">Order not found.</p>;

            return (
              <div className="space-y-6 animate-scale-up">
                {/* Back button */}
                <button
                  onClick={() => setSelectedOrderId(null)}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to orders</span>
                </button>

                {/* State Progress steps bar */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-3xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-extrabold text-gray-900">{ord.kitchenName}</h2>
                      <p className="text-[10px] text-gray-400">Placed on {new Date(ord.createdAt).toLocaleString()}</p>
                      {ord.scheduledTime && (
                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold mt-1 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/35 px-2 py-0.5 rounded-md inline-block">
                          🕒 Scheduled: {ord.scheduledTime.includes("T") ? new Date(ord.scheduledTime).toLocaleString() : ord.scheduledTime}
                        </p>
                      )}
                    </div>

                    <span className={`px-2.5 py-1 rounded-full font-bold uppercase text-[9px] ${
                      ord.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : ord.status === "CANCELLED" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800 animate-pulse"
                    }`}>
                      {ord.status}
                    </span>
                  </div>

                  {/* Progress Indicator Dots */}
                  <div className="flex items-center justify-between pt-2">
                    {(() => {
                      const steps = [
                        { label: "Placed", key: "PENDING", index: 1 },
                        { label: "Preparing", key: "PREPARING", index: 2 },
                        { label: "Out for Delivery", key: "OUT_FOR_DELIVERY", index: 3 },
                        { label: "Delivered", key: "DELIVERED", index: 4 },
                        { label: "Verified", key: "COMPLETED", index: 5 }
                      ];

                      const getStatusIndex = (status: string) => {
                        switch (status) {
                          case "PENDING": return 1;
                          case "ACCEPTED": return 2;
                          case "PREPARING": return 2;
                          case "OUT_FOR_DELIVERY": return 3;
                          case "DELIVERED": return 4;
                          case "COMPLETED": return 5;
                          default: return 1;
                        }
                      };

                      const currentStatusIdx = getStatusIndex(ord.status);

                      return steps.map((step, idx) => {
                        const isActive = step.index <= currentStatusIdx;
                        const isLineActive = step.index < currentStatusIdx;
                        return (
                          <React.Fragment key={step.key}>
                            <div className="flex flex-col items-center gap-1.5 flex-1">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${
                                isActive ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400"
                              }`}>
                                {step.index}
                              </div>
                              <span className={`text-[8px] text-center font-bold uppercase ${
                                isActive ? "text-indigo-600" : "text-gray-400"
                              }`}>{step.label}</span>
                            </div>
                            {idx < steps.length - 1 && (
                              <div className={`h-0.5 mx-1 flex-1 transition-all ${
                                isLineActive ? "bg-indigo-600" : "bg-gray-100"
                              }`} />
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Secret Delivery PIN Code - EXTREMELY UNIQUE MOTIF */}
                {ord.status !== "COMPLETED" && ord.status !== "CANCELLED" && (
                  <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl border border-slate-950 shadow-md flex justify-between items-center">
                    <div className="space-y-1.5">
                      <p className="text-[9px] text-indigo-300 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        <span>Security Delivery Verification</span>
                      </p>
                      <h3 className="font-extrabold text-sm text-white">Give Handshake PIN to Delivery</h3>
                      <p className="text-[10px] text-indigo-200/80 leading-relaxed max-w-[240px]">
                        Please share when you have received your order only.
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-1 bg-slate-950/80 rounded-2xl p-4 border border-indigo-950">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Secret PIN</p>
                      <span className="font-mono text-2xl font-black tracking-widest text-amber-300">{ord.deliveryPin}</span>
                      <button
                        onClick={() => copyPinToClipboard(ord.deliveryPin)}
                        className="p-1 rounded-md text-indigo-300 hover:text-white transition-all text-[10px] flex items-center gap-1 mt-1 cursor-pointer"
                      >
                        {copiedPin ? <Check className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
                        <span>{copiedPin ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Summary Box */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-3xs space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Order Receipt</h3>
                  <div className="divide-y divide-gray-50 dark:divide-slate-800 text-xs">
                    {ord.items.map((entry, idx) => {
                      const addOnTotal = entry.selectedAddOns?.reduce((sum, ao) => sum + ao.price, 0) || 0;
                      return (
                        <div key={idx} className="py-2 border-b border-gray-50 dark:border-slate-800 last:border-0 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-800 dark:text-slate-200">{entry.quantity}x {entry.name}</span>
                            <span className="font-mono font-bold text-gray-700 dark:text-slate-300">₹{((entry.price + addOnTotal) * entry.quantity).toFixed(2)}</span>
                          </div>
                          {entry.selectedAddOns && entry.selectedAddOns.length > 0 && (
                            <p className="text-[10px] text-gray-400 dark:text-slate-400 font-medium pl-4">
                              + {entry.selectedAddOns.map(ao => `${ao.optionName} (+₹${ao.price})`).join(', ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex justify-between pt-3 text-sm font-extrabold text-gray-900 dark:text-slate-100 border-t border-gray-100 dark:border-slate-800">
                      <span>Total Amount Paid</span>
                      <span className="font-mono text-indigo-700 dark:text-indigo-400">₹{ord.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Rate Kitchen action */}
                {ord.status === "COMPLETED" && (() => {
                  const alreadyReviewed = reviews.some(r => r.orderId === ord.id);
                  return alreadyReviewed ? (
                    <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/15 border border-emerald-100/60 dark:border-emerald-900/40 rounded-3xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 animate-scale-up">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-bold">Order reviewed successfully! Thank you for sharing your feedback with the community. ⭐</span>
                    </div>
                  ) : (
                    <div className="p-5 bg-amber-50/45 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-3xl flex justify-between items-center shadow-3xs animate-scale-up">
                      <div>
                        <h4 className="font-bold text-xs text-amber-900 dark:text-amber-200">Write a Food Review</h4>
                        <p className="text-[10px] text-amber-800 dark:text-amber-400 mt-0.5">Let {ord.kitchenName} and other neighbors know how the food tasted!</p>
                      </div>
                      <button
                        onClick={() => setShowReviewOrderId(ord.id)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 shadow-3xs cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>Review</span>
                      </button>
                    </div>
                  );
                })()}

                {/* Real-Time Chat Section */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Coordination & Direct Chat</h3>
                  <Chat
                    orderId={ord.id}
                    senderId={currentProfile.uid}
                    senderName={currentProfile.displayName}
                    isKitchenView={false}
                  />
                </div>

                {/* Review Modal popup */}
                {showReviewOrderId === ord.id && (
                  <ReviewDialog
                    orderId={ord.id}
                    kitchenId={ord.kitchenId}
                    kitchenName={ord.kitchenName}
                    customerId={currentProfile.uid}
                    customerName={currentProfile.displayName}
                    onClose={() => setShowReviewOrderId(null)}
                    onSuccess={() => {
                      setShowReviewOrderId(null);
                      showToast("Thank you for your neighborhood review! ⭐");
                    }}
                  />
                )}
              </div>
            );
          })()
        )}

        {/* TAB 5: Profile View */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-gray-950 dark:text-slate-100">My Resident Profile</h2>
              <p className="text-xs text-gray-400 dark:text-slate-400">Your verified neighborhood account details</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-2xs space-y-5 animate-scale-up">
              <div className="flex items-center gap-4 border-b border-gray-50 dark:border-slate-800 pb-5">
                <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center font-black text-2xl text-indigo-700 dark:text-indigo-400">
                  {(currentProfile.displayName || "?").charAt(0).toUpperCase()}
                </div>

                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-gray-950 dark:text-slate-100">{currentProfile.displayName}</h3>
                  <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-[9px] font-black uppercase rounded-full tracking-wider">
                    Resident Customer
                  </span>
                  <p className="text-[10px] text-gray-400 dark:text-slate-400">{currentProfile.email}</p>
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-gray-50/50 dark:border-slate-800">
                  <span className="text-gray-400 dark:text-slate-400 font-medium">Society Block Location</span>
                  <span className="font-bold text-gray-800 dark:text-slate-200">{currentProfile.flatAddress}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50/50 dark:border-slate-800">
                  <span className="text-gray-400 dark:text-slate-400 font-medium">MyGate Verification Code</span>
                  <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-sm">{currentProfile.myGateId}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50/50 dark:border-slate-800">
                  <span className="text-gray-400 dark:text-slate-400 font-medium">Phone Number</span>
                  <span className="font-bold text-gray-800 dark:text-slate-200">{currentProfile.phone}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400 dark:text-slate-400 font-medium">Account Status</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 uppercase text-[10px]">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Verified Resident</span>
                  </span>
                </div>
              </div>
            </div>

            {/* My Saved Favorites Section */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-2xs space-y-4 animate-scale-up">
              <div className="flex items-center gap-1.5 pl-1">
                <Heart className="w-4 h-4 text-rose-500 fill-current" />
                <h3 className="font-extrabold text-xs text-gray-500 dark:text-slate-400 uppercase tracking-widest">My Saved Favorites ({favorites.length})</h3>
              </div>

              {favorites.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500">No favorite dishes saved yet.</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Tap the heart icon next to any menu dish to save it here!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {favorites.map((fav) => (
                    <div 
                      key={fav.id}
                      className="p-3 bg-gray-50/50 dark:bg-slate-950/40 border border-gray-100/80 dark:border-slate-800/80 rounded-2xl flex justify-between items-center gap-3 hover:border-indigo-100 dark:hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-3 truncate flex-1">
                        {fav.imageUrl && (
                          <img 
                            src={fav.imageUrl} 
                            alt={fav.name} 
                            className="w-10 h-10 object-cover rounded-lg border border-gray-100 dark:border-slate-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="truncate flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${fav.isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                            <h4 className="font-bold text-xs text-gray-950 dark:text-slate-100 truncate">{fav.name}</h4>
                          </div>
                          <p className="font-mono text-[10px] text-gray-500 dark:text-slate-400 font-bold mt-0.5">₹{fav.price}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedKitchenId(fav.kitchenId);
                            setActiveTab("directory");
                          }}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer"
                        >
                          Order
                        </button>
                        <button
                          onClick={() => toggleFavorite({ id: fav.menuItemId, name: fav.name, price: fav.price, isVeg: fav.isVeg, imageUrl: fav.imageUrl, kitchenId: fav.kitchenId } as any)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-lg transition-colors cursor-pointer"
                          title="Remove from Favorites"
                        >
                          <Heart className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      {!(selectedKitchenId || selectedOrderId) && (
        <nav data-testid="nav-customer" className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-100 dark:border-slate-800 p-2 py-3 flex justify-around items-center z-40 shadow-lg">
          {[
            { id: "feed", label: "Discover", icon: "🍳" },
            { id: "directory", label: "Kitchens", icon: "📖" },
            { id: "cart", label: "Cart", icon: "🛒", badge: totalCartQty > 0 ? totalCartQty : undefined },
            { id: "orders", label: "Orders", icon: "📋" },
            { id: "profile", label: "Profile", icon: "👤" }
          ].map((tab) => (
            <button
              key={tab.id}
              data-testid={tab.id !== "cart" ? `nav-${tab.id}` : undefined}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedKitchenId(null);
                setSelectedOrderId(null);
              }}
              className="flex flex-col items-center gap-1 cursor-pointer group relative w-12"
            >
              <div className={`text-xl transition-transform group-hover:scale-110 ${activeTab === tab.id ? "scale-110 text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-slate-500"}`}>
                {tab.icon}
              </div>
              <span className={`text-[9px] font-bold tracking-tight uppercase ${activeTab === tab.id ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-slate-500"}`}>
                {tab.label}
              </span>
              {tab.badge && (
                <span className="absolute -top-1.5 -right-1 bg-rose-500 border border-white dark:border-slate-900 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      )}

      {/* Customizable Add-ons Selector Dialog Popup */}
      {addOnSelectionItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-slide-up">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-start shrink-0">
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${addOnSelectionItem.isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                  <h3 className="font-extrabold text-sm text-gray-950 dark:text-slate-100">{addOnSelectionItem.name}</h3>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-slate-400 font-medium leading-normal">{addOnSelectionItem.description}</p>
                <p className="text-xs font-mono font-bold text-gray-900 dark:text-slate-100">Base Price: ₹{addOnSelectionItem.price}</p>
              </div>
              <button
                onClick={() => setAddOnSelectionItem(null)}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 font-black text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Groups List */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1">
              {addOnSelectionItem.addOnGroups?.map((group) => {
                const selections = addOnSelections[group.id] || [];
                const isRequired = group.minSelections > 0;
                return (
                  <div key={group.id} className="space-y-3 bg-gray-50/50 dark:bg-slate-950/40 p-4 border border-gray-100 dark:border-slate-800 rounded-2xl">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-gray-100 dark:border-slate-800">
                      <div>
                        <span className="font-extrabold text-gray-900 dark:text-slate-100">{group.title}</span>
                        {isRequired && <span className="text-rose-500 font-black ml-1">*</span>}
                      </div>
                      <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        {group.maxSelections === 1 
                          ? "Select 1" 
                          : `Select up to ${group.maxSelections}`}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.options.map((opt) => {
                        const isSelected = selections.includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className={`flex justify-between items-center p-2.5 rounded-xl border transition-all cursor-pointer text-xs ${
                              isSelected 
                                ? "bg-indigo-50/45 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900" 
                                : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type={group.maxSelections === 1 ? "radio" : "checkbox"}
                                name={group.id}
                                checked={isSelected}
                                onChange={() => {
                                  setAddOnSelections(prev => {
                                    const curr = prev[group.id] || [];
                                    if (group.maxSelections === 1) {
                                      return { ...prev, [group.id]: [opt.id] };
                                    }
                                    if (curr.includes(opt.id)) {
                                      return { ...prev, [group.id]: curr.filter(id => id !== opt.id) };
                                    } else {
                                      if (curr.length < group.maxSelections) {
                                        return { ...prev, [group.id]: [...curr, opt.id] };
                                      }
                                        return prev;
                                    }
                                  });
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                              />
                              <span className="font-semibold text-gray-800 dark:text-slate-200">{opt.name}</span>
                            </div>
                            <span className="font-mono text-gray-500 dark:text-slate-400 text-[11px] font-bold">
                              {opt.price > 0 ? `+ ₹${opt.price}` : "FREE"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer with Subtotal & Add CTA */}
            {(() => {
              let customPrice = addOnSelectionItem.price;
              const selectedFlatAddOns: SelectedAddOn[] = [];

              addOnSelectionItem.addOnGroups?.forEach(group => {
                const selectedOptIds = addOnSelections[group.id] || [];
                selectedOptIds.forEach(oid => {
                  const opt = group.options.find(o => o.id === oid);
                  if (opt) {
                    customPrice += opt.price;
                    selectedFlatAddOns.push({
                      groupId: group.id,
                      groupTitle: group.title,
                      optionId: opt.id,
                      optionName: opt.name,
                      price: opt.price
                    });
                  }
                });
              });

              // Check validation
              let isValid = true;
              addOnSelectionItem.addOnGroups?.forEach(group => {
                const count = (addOnSelections[group.id] || []).length;
                if (count < group.minSelections) isValid = false;
                if (count > group.maxSelections) isValid = false;
              });

              return (
                <div className="p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex items-center justify-between gap-4 shrink-0">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase tracking-wider">Total Price</p>
                    <p className="font-mono text-lg font-black text-indigo-950 dark:text-indigo-200">₹{customPrice.toFixed(2)}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setAddOnSelectionItem(null)}
                      className="px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-extrabold text-xs rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!isValid) {
                          alert("Please complete the required add-on selections marked with an asterisk (*).");
                          return;
                        }
                        addToCart(addOnSelectionItem, selectedKitchenId!, selectedFlatAddOns);
                        setAddOnSelectionItem(null);
                      }}
                      disabled={!isValid}
                      className={`px-5 py-2 text-white font-black text-xs rounded-xl shadow-3xs transition-all cursor-pointer ${
                        isValid ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gray-300 dark:bg-slate-800 pointer-events-none"
                      }`}
                    >
                      Add to Basket
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Global Image Lightbox Modal */}
      {enlargedImage && (
        <div 
          onClick={() => setEnlargedImage(null)}
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4 animate-fade-in cursor-zoom-out"
        >
          <div className="relative max-w-3xl w-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-12 right-0 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-full transition-all cursor-pointer text-xs font-bold"
            >
              Close ✕
            </button>
            <img 
              src={enlargedImage} 
              alt="Enlarged Visual" 
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
