import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { collection, buildQuery, where, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, orderBy, limit, deleteField, doc, db, storage, ref, uploadBytes, getDownloadURL } from "../db";
import { UserProfile, KitchenDetails, MenuItem, FeedPost, Order, KitchenDirectMessage } from "../types";
import { Plus, Trash2, Pencil, Clipboard, Check, Shield, MessageSquare, AlertTriangle, LogOut, Clock, Layers, Star, Settings, Image, CheckCircle, ChevronRight, ArrowLeft, ToggleLeft, ToggleRight, Sun, Moon, Sparkles, Wheat, UserCircle2, Send, Search, UploadCloud, Volume2, X } from "lucide-react";
import Chat from "./Chat";
import AIImageShield from "./AIImageShield";
import { compressImage } from "../utils/imageUtils";
import { playRingtone } from "../utils/audioUtils";
import { CENTURIAN_SOCIETIES } from "../utils/addressData";

interface KitchenDashboardProps {
  currentProfile: UserProfile;
  onLogout: () => void;
}

export default function KitchenDashboard({ currentProfile, onLogout }: KitchenDashboardProps) {
  const [activeTab, setActiveTab] = useState<"orders" | "menu" | "feed" | "messages" | "settings">("orders");
  const [kitchenDetails, setKitchenDetails] = useState<KitchenDetails | null>(null);
  const [myItems, setMyItems] = useState<MenuItem[]>([]);
  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [peerKitchens, setPeerKitchens] = useState<(UserProfile & { kitchenName?: string })[]>([]);
  const [selectedKitchenPeerId, setSelectedKitchenPeerId] = useState<string | null>(null);
  const [kitchenMessages, setKitchenMessages] = useState<KitchenDirectMessage[]>([]);
  const [kitchenInboxMessages, setKitchenInboxMessages] = useState<KitchenDirectMessage[]>([]);
  const [kitchenDmDraft, setKitchenDmDraft] = useState("");
  const [kitchenPeerSearch, setKitchenPeerSearch] = useState("");
  const [kitchenRingtoneMode, setKitchenRingtoneMode] = useState<"builtin" | "custom">(
    (localStorage.getItem("kitchen_ringtone_mode") as "builtin" | "custom") || "builtin"
  );
  const [kitchenRingtoneChoice, setKitchenRingtoneChoice] = useState(localStorage.getItem("kitchen_ringtone_choice") || "Piping Hot");
  const [kitchenRingtoneUrl, setKitchenRingtoneUrl] = useState(localStorage.getItem("kitchen_ringtone_url") || "");
  const [kitchenRingtoneUploading, setKitchenRingtoneUploading] = useState(false);
  const [kitchenInboxMessageFilter, setKitchenInboxMessageFilter] = useState("");

  // Sound & Ringtone customisation states
  const prevOrdersLoadedRef = React.useRef(false);
  // Track order IDs that have already triggered the new-order popup so
  // cancelled/rejected orders never re-fire it on the next realtime tick.
  const shownOrderIdsRef = React.useRef<Set<string>>(new Set());
  // Navigation Selection
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Local theme state to reflect toggles immediately
  const [themePreference, setThemePreference] = useState<"light" | "dark">(currentProfile.themePreference === "dark" ? "dark" : "light");

  // Form States
  const [newDishName, setNewDishName] = useState("");
  const [newDishPrice, setNewDishPrice] = useState("");
  const [newDishDesc, setNewDishDesc] = useState("");
  const [newDishCategory, setNewDishCategory] = useState("Main Course");
  const [newDishVeg, setNewDishVeg] = useState(true);
  const [newDishGlutenFree, setNewDishGlutenFree] = useState(false);
  const [newDishNutFree, setNewDishNutFree] = useState(false);
  const [newDishImageBase64, setNewDishImageBase64] = useState("");

  // Post Creator States
  const [postDescription, setPostDescription] = useState("");
  const [postTaggedItemIds, setPostTaggedItemIds] = useState<string[]>([]);
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImageBase64, setPostImageBase64] = useState<string | null>(null);
  const [isScanningImage, setIsScanningImage] = useState(false);
  const [imageApproved, setImageApproved] = useState(false);
  const [hasAiSparkle, setHasAiSparkle] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Delivery Pin state
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");
  
  // New order popup state (Zomato-style)
  const [incomingNewOrder, setIncomingNewOrder] = useState<Order | null>(null);

  // UPI configuration drawer state
  const [upiId, setUpiId] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiDisplayName, setUpiDisplayName] = useState("");
  const [hardDeleteUpi, setHardDeleteUpi] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  // Stats / Operating limits
  const [kitchenMov, setKitchenMov] = useState(100);
  const [deliveryLocations, setDeliveryLocations] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [kitchenVegType, setKitchenVegType] = useState<"veg" | "both" | "non-veg">("veg");
  const [showVegUpgradeWarning, setShowVegUpgradeWarning] = useState(false);
  const [pendingVegType, setPendingVegType] = useState<"veg" | "both" | "non-veg" | null>(null);
  const [kitchenHandle, setKitchenHandle] = useState("");
  const [kitchenProfileImageUrl, setKitchenProfileImageUrl] = useState("");
  // Prevent live snapshot from wiping a just-selected (unsaved) profile photo
  const profileImageDirtyRef = React.useRef(false);

  // Visual feedback Toast
  const [toastMessage, setToastMessage] = useState("");

  // Security and Address Disputes State
  const [securityAlerts, setSecurityAlerts] = useState<{ id: string; title: string; text: string; createdAt: number }[]>([]);

  const dismissSecurityAlert = async (alertId: string) => {
    try {
      await deleteDoc(doc(db, "notifications", alertId));
      showToast("Notification dismissed.");
    } catch (err) {
      console.error("Failed to dismiss notification:", err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2500);
  };

  const playConfiguredRingtone = async () => {
    if (kitchenRingtoneMode === "custom" && kitchenRingtoneUrl) {
      try {
        const audio = new Audio(kitchenRingtoneUrl);
        audio.volume = 1;
        await audio.play();
        return;
      } catch (err) {
        console.error("Custom ringtone playback failed, falling back to builtin:", err);
      }
    }
    await playRingtone(kitchenRingtoneChoice || "Piping Hot");
  };

  const uploadProfileImage = async (file: File | null) => {
    if (!file) return;
    let instantPreview = "";
    try {
      profileImageDirtyRef.current = true;
      instantPreview = URL.createObjectURL(file);
      setKitchenProfileImageUrl(instantPreview);
      const url = await compressImage(file);
      setKitchenProfileImageUrl(url);
      if (instantPreview) {
        URL.revokeObjectURL(instantPreview);
        instantPreview = "";
      }
    } catch (err) {
      console.error("Kitchen profile image upload failed:", err);
      profileImageDirtyRef.current = false;
      if (instantPreview) {
        URL.revokeObjectURL(instantPreview);
      }
      setKitchenProfileImageUrl(kitchenDetails?.profileImageUrl || "");
      showToast("Failed to upload profile image.");
    }
  };

  const uploadKitchenRingtone = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      showToast("Please upload an audio file for the ringtone.");
      return;
    }

    try {
      setKitchenRingtoneUploading(true);
      const storageRef = ref(storage, `kitchen-ringtones/${currentProfile.uid}/${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setKitchenRingtoneMode("custom");
      setKitchenRingtoneUrl(url);
      localStorage.setItem("kitchen_ringtone_mode", "custom");
      localStorage.setItem("kitchen_ringtone_url", url);
      showToast("Custom ringtone uploaded.");
    } catch (err) {
      console.error("Kitchen ringtone upload failed:", err);
      showToast("Failed to upload ringtone.");
    } finally {
      setKitchenRingtoneUploading(false);
    }
  };

  const currentKitchenPin = kitchenDetails?.securityPin || currentProfile.securityPin || "";

  // Security PIN challenge modal state (see requestKitchenPin below).
  const [pinPrompt, setPinPrompt] = useState<{ reason: string; resolve: (ok: boolean) => void } | null>(null);
  const [pinInputValue, setPinInputValue] = useState("");
  const [pinInputError, setPinInputError] = useState("");
  const pinPromptRef = React.useRef<{ reason: string; resolve: (ok: boolean) => void } | null>(null);

  // Resolves to true when the protected action may proceed. If the kitchen never
  // configured a PIN there is nothing to verify against, so the action is allowed.
  const requestKitchenPin = (reason: string): Promise<boolean> => {
    if (!currentKitchenPin) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      const prompt = { reason, resolve };
      pinPromptRef.current = prompt;
      setPinInputValue("");
      setPinInputError("");
      setPinPrompt(prompt);
    });
  };

  const resolvePinPrompt = (ok: boolean) => {
    const prompt = pinPromptRef.current;
    pinPromptRef.current = null;
    setPinPrompt(null);
    setPinInputValue("");
    setPinInputError("");
    prompt?.resolve(ok);
  };

  const submitPinPrompt = () => {
    if (!pinPrompt) return;
    if (pinInputValue.trim() === currentKitchenPin) {
      resolvePinPrompt(true);
    } else {
      setPinInputError("Incorrect PIN. Please try again.");
    }
  };

  const protectedUpdate = async (reason: string, action: () => Promise<void>) => {
    if (!(await requestKitchenPin(reason))) return false;
    await action();
    return true;
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

  // Return Button compatibility state reference
  const isHistoryUpdate = React.useRef(false);

  // Enlarged Image Modal
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Handle return button compatibility (back gestures / back buttons on iOS/Android/Desktop)
  useEffect(() => {
    window.history.replaceState({ tab: activeTab, orderId: selectedOrderId }, "");

    const handlePopState = (e: PopStateEvent) => {
      if (e.state) {
        isHistoryUpdate.current = true;
        setActiveTab(e.state.tab || "orders");
        isHistoryUpdate.current = true;
        setSelectedOrderId(e.state.orderId || null);
      } else {
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
      orderId: selectedOrderId
    }, "");
  }, [activeTab, selectedOrderId]);

  useEffect(() => {
    const chefId = currentProfile.uid;

    // 1. Fetch chef's kitchen profile
    const unsubKitchen = onSnapshot(doc(db, "kitchens", chefId), (docSnap) => {
    if (docSnap.exists()) {
        const details = docSnap.data() as KitchenDetails;
        setKitchenDetails(details);
        setUpiId(details.upiId || "");
        setBankName(details.bankName || "");
        setUpiDisplayName(details.upiDisplayName || "");
        setKitchenMov(details.mov || 100);
        setQrCodeUrl(details.qrCodeUrl || "");
        setDeliveryLocations(details.deliveryLocations || []);
        setKitchenVegType(details.vegType || "veg");
        setKitchenHandle(details.handle || "");
        if (!profileImageDirtyRef.current) {
          setKitchenProfileImageUrl(details.profileImageUrl || "");
        }
        setKitchenRingtoneMode((details.ringtoneMode as "builtin" | "custom") || (localStorage.getItem("kitchen_ringtone_mode") as "builtin" | "custom") || "builtin");
        setKitchenRingtoneChoice(details.ringtoneChoice || localStorage.getItem("kitchen_ringtone_choice") || "Piping Hot");
        setKitchenRingtoneUrl(details.ringtoneUrl || localStorage.getItem("kitchen_ringtone_url") || "");
        setCustomCategories(details.customCategories || []);
      }
    });

    // 2. Fetch chef's menu items
    const qMenu = buildQuery(collection(db, "menu_items"), where("kitchenId", "==", chefId));
    const unsubMenu = onSnapshot(qMenu, (snap) => {
      const list: MenuItem[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as MenuItem));
      setMyItems(list);
    });

    // 3. Fetch chef's published feed posts
    const qPosts = buildQuery(collection(db, "feed_posts"), where("kitchenId", "==", chefId));
    const unsubPosts = onSnapshot(qPosts, (snap) => {
      const list: FeedPost[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as FeedPost));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setMyPosts(list);
    });

    // 4. Fetch incoming orders
    const qOrders = buildQuery(collection(db, "orders"), where("kitchenId", "==", chefId));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const list: Order[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Order));
      list.sort((a, b) => b.createdAt - a.createdAt);

      let hasNewPendingOrder = false;
      let newestPendingOrder: Order | null = null;
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const orderData = change.doc.data() as Order;
          // Only treat genuinely new PENDING orders as incoming alerts.
          // Previously every snapshot refresh was reported as "added",
          // which caused cancelled/rejected orders to re-popup forever.
          if (orderData.status === "PENDING" && !shownOrderIdsRef.current.has(change.doc.id)) {
            hasNewPendingOrder = true;
            if (!newestPendingOrder || orderData.createdAt > newestPendingOrder.createdAt) {
              newestPendingOrder = { id: change.doc.id, ...orderData };
            }
          }
        }
      });

      if (hasNewPendingOrder && prevOrdersLoadedRef.current && newestPendingOrder) {
        shownOrderIdsRef.current.add(newestPendingOrder.id);
        void playConfiguredRingtone();
        setIncomingNewOrder(newestPendingOrder);
      }

      prevOrdersLoadedRef.current = true;
      setIncomingOrders(list);
    });

    // 5. Fetch reviews left for this kitchen
    const qReviews = buildQuery(collection(db, "reviews"), where("kitchenId", "==", chefId));
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setReviews(list);
    });

    // 6. Fetch real-time security alerts
    const qNotifications = buildQuery(collection(db, "notifications"), where("userId", "==", chefId));
    const unsubNotifications = onSnapshot(qNotifications, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setSecurityAlerts(list);

      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const notifData = change.doc.data();
          if (notifData.createdAt > Date.now() - 10000) {
            showToast(`🚨 ${notifData.title || "Security Alert"}: ${notifData.text}`);
          }
        }
      });
    }, (err) => {
      console.error("Failed to sync notifications:", err);
    });

    // Read peers from the secret-free projection (users table is self+admin only).
    const qPeers = buildQuery(collection(db, "public_profiles"), where("role", "==", "kitchen"), limit(50));
    const unsubPeers = onSnapshot(qPeers, (snap) => {
      const list: (UserProfile & { kitchenName?: string })[] = [];
      snap.forEach((d) => {
        const data = d.data() as UserProfile & { kitchenName?: string };
        if (d.id !== chefId) {
          list.push({ uid: d.id, ...data });
        }
      });
      list.sort((a, b) => (a.displayName || a.kitchenName || "").localeCompare(b.displayName || b.kitchenName || ""));
      setPeerKitchens(list);
    }, (err) => {
      console.error("Failed to load kitchen peers:", err);
    });

    return () => {
      unsubKitchen();
      unsubMenu();
      unsubPosts();
      unsubOrders();
      unsubReviews();
      unsubNotifications();
      unsubPeers();
    };
  }, [currentProfile.uid]);

  useEffect(() => {
    if (!selectedKitchenPeerId) {
      setKitchenMessages([]);
      return;
    }

    const ids = [currentProfile.uid, selectedKitchenPeerId].sort();
    const conversationId = ids.join("__");
    const qMessages = buildQuery(
      collection(db, "kitchen_chats"),
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );

    const unsubMessages = onSnapshot(qMessages, (snap) => {
      const list: KitchenDirectMessage[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as KitchenDirectMessage));
      setKitchenMessages(list);
    }, (err) => {
      console.error("Failed to load kitchen messages:", err);
    });

    return () => unsubMessages();
  }, [currentProfile.uid, selectedKitchenPeerId]);

  useEffect(() => {
    if (selectedKitchenPeerId) {
      markConversationRead(selectedKitchenPeerId);
    }
  }, [selectedKitchenPeerId, kitchenMessages.length]);

  useEffect(() => {
    const qInbox = buildQuery(
      collection(db, "kitchen_chats"),
      where("participants", "array-contains", currentProfile.uid),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsubInbox = onSnapshot(qInbox, (snap) => {
      const list: KitchenDirectMessage[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as KitchenDirectMessage));
      setKitchenInboxMessages(list);
    }, (err) => {
      console.error("Failed to load kitchen inbox:", err);
    });

    return () => unsubInbox();
  }, [currentProfile.uid]);

  // Handle menu item add
  const handleAddCustomCategory = async () => {
    const trimmed = newCustomCategory.trim();
    if (!trimmed) return;
    if (customCategories.includes(trimmed)) {
      showToast("Category already exists.");
      return;
    }
    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    setNewCustomCategory("");
    setShowAddCategory(false);
    setNewDishCategory(trimmed);
    try {
      await updateDoc(doc(db, "kitchens", currentProfile.uid), {
        customCategories: updated
      });
      showToast(`Category "${trimmed}" added!`);
    } catch (err) {
      console.error("Failed to save custom category:", err);
      showToast("Failed to save category.");
    }
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newDishPrice);
    if (!newDishName.trim() || isNaN(price) || price <= 0) return;

    try {
      if (!(await requestKitchenPin("Add a new menu item?"))) return;
      const newItemId = "menu_" + Date.now();
      await setDoc(doc(db, "menu_items", newItemId), {
        id: newItemId,
        kitchenId: currentProfile.uid,
        name: newDishName.trim(),
        description: newDishDesc.trim(),
        price,
        isVeg: newDishVeg,
        isGlutenFree: newDishGlutenFree,
        isNutFree: newDishNutFree,
        isAvailable: true,
        category: newDishCategory,
        createdAt: new Date().toISOString(),
        imageUrl: newDishImageBase64 || ""
      });

      setNewDishName("");
      setNewDishPrice("");
      setNewDishDesc("");
      setNewDishVeg(true);
      setNewDishGlutenFree(false);
      setNewDishNutFree(false);
      setNewDishImageBase64("");
      showToast("Menu item added successfully! 🟢");
    } catch (err) {
      console.error("Failed to add menu item:", err);
    }
  };

  // Toggle dish availability
  const toggleAvailability = async (item: MenuItem) => {
    try {
      if (!(await requestKitchenPin(`Toggle availability for "${item.name}"?`))) return;
      // Find the document to update. We used addDoc so we need to query by id
      const q = buildQuery(collection(db, "menu_items"), where("id", "==", item.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, "menu_items", snap.docs[0].id), { isAvailable: !item.isAvailable });
        showToast(`Dished marked as ${!item.isAvailable ? "Available" : "Resting"}`);
      }
    } catch (err) {
      console.error("Error toggling item availability:", err);
    }
  };

  // Delete dish item
  const handleDeleteDish = async (itemId: string) => {
    if (!window.confirm("Are you sure you want to remove this dish from your kitchen menu?")) return;
    try {
      if (!(await requestKitchenPin("Delete this menu item permanently?"))) return;
      const q = buildQuery(collection(db, "menu_items"), where("id", "==", itemId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, "menu_items", snap.docs[0].id));
        showToast("Dish removed from menu.");
      }
    } catch (err) {
      console.error("Error deleting menu item:", err);
    }
  };

  // Update kitchen general MOV
  const handleUpdateMov = async () => {
    try {
      const ok = await protectedUpdate("Update your kitchen Minimum Order Value (MOV)?", async () => {
        await updateDoc(doc(db, "kitchens", currentProfile.uid), { mov: kitchenMov });
      });
      if (!ok) return;
      showToast("Minimum Order Value (MOV) updated! ₹" + kitchenMov);
    } catch (err) {
      console.error("Failed to update kitchen MOV:", err);
    }
  };

  // Update kitchen delivery coverage locations
  const handleSaveDeliveryLocations = async () => {
    try {
      const ok = await protectedUpdate("Save delivery coverage changes?", async () => {
        await updateDoc(doc(db, "kitchens", currentProfile.uid), {
          deliveryLocations: deliveryLocations
        });
      });
      if (!ok) return;
      showToast("Delivery coverage saved successfully! 🚚");
    } catch (err) {
      console.error("Failed to update delivery locations:", err);
      showToast("Failed to save delivery coverage.");
    }
  };

  const handleToggleDeliveryLocation = (location: string) => {
    if (deliveryLocations.includes(location)) {
      setDeliveryLocations(prev => prev.filter(loc => loc !== location));
    } else {
      setDeliveryLocations(prev => [...prev, location]);
    }
  };

  // Update Operating Schedule toggle mode
  const handleUpdateOperatingMode = async (mode: "online" | "break" | "day_off" | "vacation") => {
    try {
      const ok = await protectedUpdate(`Change operating mode to ${mode.toUpperCase()}?`, async () => {
        await updateDoc(doc(db, "kitchens", currentProfile.uid), {
          operatingMode: mode,
          isOnline: mode === "online"
        });
      });
      if (!ok) return;
      showToast(`Operating mode updated to: ${mode.toUpperCase()} 🕒`);
    } catch (err) {
      console.error("Failed to update operating mode:", err);
    }
  };

  // Update UPI credentials drawer
  const handleSaveUpiProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!(await requestKitchenPin("Save or wipe UPI payment settings?"))) return;
      const updateData = hardDeleteUpi ? {
        upiId: deleteField(),
        bankName: deleteField(),
        upiDisplayName: deleteField(),
        qrCodeUrl: deleteField()
      } : {
        upiId: upiId.trim(),
        bankName: bankName.trim(),
        upiDisplayName: upiDisplayName.trim(),
        qrCodeUrl: qrCodeUrl
      };

      await updateDoc(doc(db, "kitchens", currentProfile.uid), updateData);
      
      if (hardDeleteUpi) {
        setUpiId("");
        setBankName("");
        setUpiDisplayName("");
        setHardDeleteUpi(false);
        showToast("UPI payment details permanently wiped out! 🧹");
      } else {
        showToast("UPI payment profile configured! 🔐");
      }
    } catch (err) {
      console.error("Failed to save UPI info:", err);
    }
  };

  const handleSaveKitchenProfile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const normalizedHandle = kitchenHandle.trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
    try {
      const ok = await protectedUpdate("Save kitchen profile changes?", async () => {
        const updates = { handle: normalizedHandle, profileImageUrl: kitchenProfileImageUrl };
        await updateDoc(doc(db, "users", currentProfile.uid), updates);
        await updateDoc(doc(db, "kitchens", currentProfile.uid), updates);
      });
      if (!ok) return;
      profileImageDirtyRef.current = false;
      showToast("Kitchen profile updated!");
    } catch (err) {
      console.error("Failed to save kitchen profile:", err);
      showToast("Failed to save kitchen profile.");
    }
  };

  const handleSaveRingtoneProfile = async () => {
    try {
      const ok = await protectedUpdate("Save kitchen ringtone settings?", async () => {
        await updateDoc(doc(db, "kitchens", currentProfile.uid), {
          ringtoneMode: kitchenRingtoneMode,
          ringtoneChoice: kitchenRingtoneChoice,
          ringtoneUrl: kitchenRingtoneMode === "custom" ? kitchenRingtoneUrl : ""
        });
      });
      if (!ok) return;
      localStorage.setItem("kitchen_ringtone_mode", kitchenRingtoneMode);
      localStorage.setItem("kitchen_ringtone_choice", kitchenRingtoneChoice);
      localStorage.setItem("kitchen_ringtone_url", kitchenRingtoneUrl);
      showToast("Ringtone settings saved.");
    } catch (err) {
      console.error("Failed to save ringtone profile:", err);
      showToast("Failed to save ringtone settings.");
    }
  };

  // Handle feed file uploading & client side compression
  const handleFeedFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setPostImageFile(file);
      setIsScanningImage(true);
      setImageApproved(false);

      // Compress to under 250KB JPEG
      const compressedUrl = await compressImage(file);
      setPostImageBase64(compressedUrl);
    } catch (err) {
      console.error("Image compression error:", err);
      setIsScanningImage(false);
    }
  };

  // Handle feed post creation
  const handlePublishFeedPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await requestKitchenPin("Publish this kitchen feed post?"))) return;

    if (!postImageBase64 || !imageApproved) return;

    const taggedItems = myItems.filter(mi => postTaggedItemIds.includes(mi.id));

    const customPostId = "post_" + Date.now();
    try {
      await setDoc(doc(db, "feed_posts", customPostId), {
        id: customPostId,
        kitchenId: currentProfile.uid,
        kitchenName: kitchenDetails?.kitchenName || currentProfile.displayName,
        description: postDescription.trim(),
        imageUrl: postImageBase64,
        likes: [],
        taggedItemIds: taggedItems.map(mi => mi.id),
        createdAt: new Date().toISOString(),
        hasAiSparkle: hasAiSparkle,
        aiSparkleImposed: false
      });

      // Clear states
      setPostDescription("");
      setPostTaggedItemIds([]);
      setPostImageFile(null);
      setPostImageBase64(null);
      setImageApproved(false);
      setHasAiSparkle(false);
      showToast("Successfully published to CP-Eats Feed! 🚀");
    } catch (err) {
      console.error("Failed to create feed post:", err);
    }
  };

  // Delete feed post
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this social feed post?")) return;
    try {
      if (!(await requestKitchenPin("Delete this feed post permanently?"))) return;
      const q = buildQuery(collection(db, "feed_posts"), where("id", "==", postId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, "feed_posts", snap.docs[0].id));
        showToast("Social post deleted.");
      }
    } catch (err) {
      console.error("Failed to delete post:", err);
    }
  };

  const handleStartEditPost = (post: FeedPost) => {
    setEditingPostId(post.id);
    setPostDescription(post.description);
    setPostTaggedItemIds(post.taggedItemIds || []);
    setPostImageBase64(post.imageUrl);
    setHasAiSparkle(post.hasAiSparkle || false);
    setImageApproved(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setPostDescription("");
    setPostTaggedItemIds([]);
    setPostImageBase64(null);
    setImageApproved(false);
    setHasAiSparkle(false);
    setPostImageFile(null);
  };

  const handleUpdateFeedPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPostId || !(await requestKitchenPin("Save changes to this post?"))) return;
    if (!postImageBase64 || !imageApproved) return;

    const taggedItems = myItems.filter(mi => postTaggedItemIds.includes(mi.id));
    try {
      const q = buildQuery(collection(db, "feed_posts"), where("id", "==", editingPostId));
      const snap = await getDocs(q);
      const docId = snap.docs[0]?.id;
      if (!docId) {
        showToast("Post not found.");
        return;
      }
      await updateDoc(doc(db, "feed_posts", docId), {
        description: postDescription.trim(),
        imageUrl: postImageBase64,
        taggedItemIds: taggedItems.map(mi => mi.id),
        hasAiSparkle: hasAiSparkle,
      });
      showToast("Post updated successfully! ✨");
      handleCancelEdit();
    } catch (err) {
      console.error("Failed to update post:", err);
      showToast("Failed to update post.");
    }
  };

  // Send Billing payment card into chat
  const handleSendBillingRequest = async (amount: number) => {
    if (!selectedOrderId) return;
    const ord = incomingOrders.find(o => o.id === selectedOrderId);
    if (!ord) return;

    if (!kitchenDetails?.upiId) {
      showToast("❌ Please configure your UPI Handle in Settings before requesting payments.");
      return;
    }

    try {
      const messageId = "chat_" + Date.now();
      await setDoc(doc(db, "chats", messageId), {
        id: messageId,
        orderId: selectedOrderId,
        senderId: currentProfile.uid,
        senderName: kitchenDetails.kitchenName,
        text: `Requested payment of ₹${amount.toFixed(2)}`,
        isUpiCard: true,
        upiCardData: {
          upiId: kitchenDetails.upiId,
          amount,
          displayName: kitchenDetails.upiDisplayName || currentProfile.displayName,
          bankName: kitchenDetails.bankName || "HDFC Bank"
        },
        qrCodeUrl: qrCodeUrl || kitchenDetails?.qrCodeUrl || "",
        createdAt: new Date().toISOString()
      });

      showToast("Secure UPI request card sent to chat! 💳");
    } catch (err) {
      console.error("Failed to send billing invoice:", err);
    }
  };

  const getSelectedKitchenPeer = () => peerKitchens.find((k) => k.uid === selectedKitchenPeerId) || null;

  const getConversationId = (peerId: string) => [currentProfile.uid, peerId].sort().join("__");

  const getLastReadAt = (peerId: string) => {
    try {
      return Number(localStorage.getItem(`kdm_last_read_${getConversationId(peerId)}`) || "0");
    } catch {
      return 0;
    }
  };

  const markConversationRead = (peerId: string) => {
    localStorage.setItem(`kdm_last_read_${getConversationId(peerId)}`, String(Date.now()));
  };

  const deriveInbox = () => {
    const latestByConversation = new Map<string, KitchenDirectMessage>();
    kitchenInboxMessages.forEach((msg) => {
      latestByConversation.set(msg.conversationId, msg);
    });

    return peerKitchens
      .map((peer) => {
        const conversationId = getConversationId(peer.uid);
        const lastMessage = latestByConversation.get(conversationId) || null;
        const unreadCount = kitchenInboxMessages.filter(
          (msg) => msg.conversationId === conversationId && msg.senderId !== currentProfile.uid && (msg.createdAt as number) > getLastReadAt(peer.uid)
        ).length;
        return { peer, conversationId, lastMessage, unreadCount };
      })
      .filter((item) => {
        const haystack = `${item.peer.displayName || ""} ${item.peer.handle || ""} ${item.peer.kitchenName || ""}`.toLowerCase();
        return haystack.includes(kitchenInboxMessageFilter.toLowerCase().trim());
      })
      .sort((a, b) => {
        const ta = Number(a.lastMessage?.createdAt || 0);
        const tb = Number(b.lastMessage?.createdAt || 0);
        return tb - ta;
      });
  };

  const handleSendKitchenMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipient = getSelectedKitchenPeer();
    const text = kitchenDmDraft.trim();
    if (!recipient || !text) return;

    try {
      if (!(await requestKitchenPin("Send this kitchen-to-kitchen message?"))) return;
      const conversationId = [currentProfile.uid, recipient.uid].sort().join("__");
      const messageId = `kdm_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await setDoc(doc(db, "kitchen_chats", messageId), {
        id: messageId,
        conversationId,
        participants: [currentProfile.uid, recipient.uid],
        senderId: currentProfile.uid,
        senderName: kitchenDetails?.kitchenName || currentProfile.displayName,
        senderHandle: kitchenDetails?.handle || currentProfile.handle || "",
        recipientId: recipient.uid,
        recipientName: recipient.kitchenName || recipient.displayName,
        recipientHandle: recipient.handle || "",
        text,
        createdAt: new Date().toISOString()
      });
      setKitchenDmDraft("");
    } catch (err) {
      console.error("Failed to send kitchen DM:", err);
      showToast("Failed to send message.");
    }
  };

  // Verify secret Delivery PIN code and Complete Order
  const handleVerifyDeliveryPin = async (ord: Order) => {
    if (enteredPin !== ord.deliveryPin) {
      setPinError("Invalid delivery PIN code. Please check with customer.");
      return;
    }

    setPinError("");
    try {
      await updateDoc(doc(db, "orders", ord.id), { status: "COMPLETED" });
      showToast("Order transaction COMPLETED! Verification handshake successful. 🎉");
      setEnteredPin("");
    } catch (err) {
      console.error("Failed to complete order:", err);
    }
  };

  // Toggle order Accepted state
  const handleAcceptOrder = async (ord: Order) => {
    try {
      await updateDoc(doc(db, "orders", ord.id), { status: "ACCEPTED" });
      showToast("Order status updated to preparing.");
    } catch (err) {
      console.error("Error accepting order:", err);
    }
  };

  // Update order status incrementally
  const handleUpdateStatus = async (ord: Order, newStatus: any) => {
    try {
      await updateDoc(doc(db, "orders", ord.id), { status: newStatus });
      showToast(`Order updated to: ${newStatus}`);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  // Toggle order Cancelled state
  const handleCancelOrder = async (ord: Order) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    try {
      await updateDoc(doc(db, "orders", ord.id), { status: "CANCELLED" });
      showToast("Order cancelled.");
    } catch (err) {
      console.error("Error cancelling order:", err);
    }
  };

  const activeOrdersCount = incomingOrders.filter(o => ["PENDING", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(o.status)).length;

  const saveKitchenVegType = async () => {
    if (!pendingVegType) return;
    const nextType = pendingVegType;
    const isIrreversibleUpgrade = kitchenVegType === "veg" && nextType !== "veg";
    if (isIrreversibleUpgrade) {
      setShowVegUpgradeWarning(true);
      return;
    }

    if (!(await requestKitchenPin("Save kitchen food type changes?"))) return;

    try {
      await updateDoc(doc(db, "kitchens", currentProfile.uid), { vegType: nextType });
      setKitchenVegType(nextType);
      showToast(`Kitchen type updated to ${nextType.toUpperCase()}.`);
    } catch (err) {
      console.error("Failed to update kitchen veg type:", err);
      showToast("Failed to update kitchen type.");
    }
  };

  return (
    <div data-testid="kitchen-dashboard" className="flex flex-col min-h-screen bg-background-primary text-text-primary dark:bg-slate-950 dark:text-slate-100 pb-20 font-sans transition-colors duration-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 px-4 py-3 bg-text-primary text-text-inverse text-xs font-semibold rounded-2xl shadow-theme z-50 flex items-center gap-2 animate-scale-up">
          <div className="w-2 h-2 bg-feedback-success rounded-full animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 bg-background-secondary/95 dark:bg-background-secondary/90 backdrop-blur-md border-b border-border-primary px-6 py-4 flex items-center justify-between z-30 shadow-theme">
        <div
          onClick={() => {
            setSelectedOrderId(null);
            setActiveTab("orders");
          }}
          className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity"
          title="Go to Orders Board"
        >
          <div className="w-9 h-9 rounded-xl bg-brand-primary flex items-center justify-center font-black text-white text-lg tracking-wider shadow-sm">
            🍳
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-text-primary uppercase">{kitchenDetails?.kitchenName || currentProfile.displayName}</h1>
            <p className="text-[10px] text-text-muted font-medium">Verified Centurian Kitchen Seller</p>
            <p className="text-[10px] text-text-muted font-medium">{currentProfile.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            data-testid="theme-toggle"
            onClick={handleToggleTheme}
            className="p-2 text-text-muted hover:text-brand-primary dark:hover:text-amber-400 transition-colors cursor-pointer"
            title={themePreference === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {themePreference === "dark" ? (
              <Sun className="w-5 h-5 text-amber-400 animate-pulse" />
            ) : (
              <Moon className="w-5 h-5 text-text-muted" />
            )}
          </button>

          <button
            data-testid="logout-button"
            onClick={onLogout}
            className="p-2 text-text-muted hover:text-brand-primary transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Security Alerts Banner */}
      {securityAlerts.length > 0 && (
        <div id="security-alerts-banner-list" className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-3 space-y-2">
          {securityAlerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-3 text-rose-800 dark:text-rose-400">
              <div className="p-1 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0 animate-pulse">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex-1 text-[11px] leading-relaxed font-semibold">
                <span className="font-extrabold uppercase tracking-wide block text-rose-700 dark:text-rose-300 text-[10px] mb-0.5">⚠️ {alert.title}</span>
                {alert.text}
              </div>
              <button
                onClick={() => dismissSecurityAlert(alert.id)}
                className="text-[10px] bg-rose-500/20 hover:bg-rose-500/35 px-2.5 py-1 rounded-md text-rose-700 dark:text-rose-300 font-extrabold transition-colors cursor-pointer self-center"
              >
                Dismiss Alert
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-5 space-y-6">

        {/* TAB 1: Kitchen Orders Dashboard */}
        {activeTab === "orders" && !selectedOrderId && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-text-primary">Incoming Orders</h2>
              <p className="text-xs text-text-muted">Validate deliveries using Customer Delivery PIN codes</p>
            </div>

            {/* Quick stats panel */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background-secondary p-4 rounded-3xl border border-border-primary text-center space-y-1.5 shadow-theme">
                <p className="text-[10px] text-text-muted font-extrabold uppercase tracking-wider">Today's Orders</p>
                <p className="text-xl font-black text-brand-primary">
                  {incomingOrders.filter(o => o.status !== "CANCELLED").length} active
                </p>
              </div>
              <div className="bg-background-secondary p-4 rounded-3xl border border-border-primary text-center space-y-1.5 shadow-theme">
                <p className="text-[10px] text-text-muted font-extrabold uppercase tracking-wider">Estimated Revenue</p>
                <p className="text-xl font-black text-feedback-success">
                  ₹{incomingOrders.filter(o => o.status === "COMPLETED").reduce((sum, o) => sum + o.total, 0).toFixed(2)}
                </p>
              </div>
            </div>

            {incomingOrders.length === 0 ? (
              <div className="text-center py-12 px-6 bg-background-secondary rounded-3xl border border-border-primary shadow-theme space-y-4">
                <div className="w-16 h-16 bg-brand-primary-container/60 dark:bg-brand-primary-container/10 rounded-full flex items-center justify-center mx-auto text-brand-primary">
                  <Layers className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-text-primary">It's quiet on the orders front...</p>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">Once a verified neighbor orders from your delicious menu, their request will instantly appear here with live notifications!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {incomingOrders.map((ord) => (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrderId(ord.id)}
                    className="p-5 bg-background-secondary rounded-3xl border border-border-primary shadow-theme hover:shadow-md hover:border-brand-primary/40 transition-all cursor-pointer flex justify-between items-center animate-fade-in"
                  >
                    <div className="space-y-2 pr-4 truncate">
                       <div>
                         <h3 className="font-extrabold text-xs text-text-primary truncate">
                           {ord.customerName}
                           {ord.customerAddress ? ` (${ord.customerAddress.split(",")[1]?.trim() || "Flat"})` : ""}
                         </h3>
                         <p className="text-[10px] text-text-muted font-bold">
                           {ord.items.length} items • ₹{ord.total}
                         </p>
                       </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[9px] bg-background-primary border border-border-primary text-text-secondary px-1.5 py-0.5 rounded-sm font-mono font-medium">
                          {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[9px] bg-brand-primary-container border border-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded-sm font-extrabold uppercase tracking-wider">
                          {ord.deliveryType === "pickup" ? "Self-Pickup" : "Home Delivery"}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right space-y-1.5">
                      <span className={`px-2.5 py-1 rounded-full font-extrabold uppercase text-[9px] tracking-wider ${
                        ord.status === "COMPLETED" ? "bg-emerald-50 text-emerald-800" : ord.status === "CANCELLED" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800 animate-pulse"
                      }`}>
                        {ord.status}
                      </span>
                      <p className="text-[9px] text-text-muted font-bold">Review & Chat →</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detailed Kitchen Order Detail View */}
        {activeTab === "orders" && selectedOrderId && (
          (() => {
            const ord = incomingOrders.find(o => o.id === selectedOrderId);
            if (!ord) return <p className="text-xs text-gray-400">Order details not found.</p>;

            return (
              <div className="space-y-6 animate-scale-up">
                {/* Back Link */}
                <button
                  onClick={() => setSelectedOrderId(null)}
                  className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-brand-primary font-bold cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to incoming orders</span>
                </button>

                <div className="bg-background-secondary rounded-3xl p-5 border border-border-primary shadow-theme space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h2 className="text-sm font-black text-text-primary uppercase">Order from {ord.customerName}</h2>
                      <p className="text-[10px] text-text-muted font-semibold">📍 Address: {ord.customerAddress}</p>
                      <p className="text-[10px] text-text-muted font-semibold">📞 Phone: {ord.customerPhone}</p>
                      {ord.scheduledTime && (
                        <p className="text-[10px] text-brand-primary font-extrabold mt-1.5 uppercase tracking-wider bg-brand-primary-container border border-brand-primary/20 px-2 py-0.5 rounded-md inline-block">
                          🕒 Scheduled: {ord.scheduledTime.includes("T") ? new Date(ord.scheduledTime).toLocaleString() : ord.scheduledTime}
                        </p>
                      )}
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                      ord.deliveryType === "pickup" ? "bg-amber-100 text-amber-800" : "bg-brand-primary-container text-brand-primary border border-brand-primary/20"
                    }`}>
                      {ord.deliveryType === "pickup" ? "Self-Pickup" : "Door Delivery"}
                    </span>
                  </div>

                  <hr className="border-border-primary" />

                  {/* Items list */}
                  <div className="space-y-2 text-xs">
                    {ord.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-text-secondary">
                        <span className="font-semibold">{item.quantity}x {item.name}</span>
                        <span className="font-mono text-text-muted font-bold">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-3 text-sm font-extrabold text-text-primary border-t border-border-primary">
                      <span>Customer Payable Total</span>
                      <span className="font-mono text-brand-primary">₹{ord.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Actions (Accept/Cancel) */}
                  {ord.status === "PENDING" && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => handleCancelOrder(ord)}
                        className="py-2 border border-border-primary hover:bg-background-primary text-rose-600 font-extrabold rounded-xl text-xs transition-all cursor-pointer"
                      >
                        Decline Order
                      </button>
                      <button
                        onClick={() => handleAcceptOrder(ord)}
                        className="py-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-extrabold rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                      >
                        Accept & Prepare
                      </button>
                    </div>
                  )}

                  {/* Status update controller */}
                  {["ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(ord.status) && (
                    <div className="bg-background-primary rounded-2xl p-4 border border-border-primary space-y-3 pt-3">
                      <p className="text-[10px] text-text-muted font-extrabold uppercase tracking-wider">Update Order Progress Status</p>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { status: "PREPARING", label: "🍳 Preparing", weight: 2 },
                          { status: "OUT_FOR_DELIVERY", label: "🚴 Out for Delivery", weight: 3 },
                          { status: "DELIVERED", label: "✅ Delivered", weight: 4 }
                        ].map((btn) => {
                          const getStatusWeight = (status: string) => {
                            switch (status) {
                              case "PENDING": return 0;
                              case "ACCEPTED": return 1;
                              case "PREPARING": return 2;
                              case "OUT_FOR_DELIVERY": return 3;
                              case "DELIVERED": return 4;
                              case "COMPLETED": return 5;
                              default: return 0;
                            }
                          };

                          const isCurrent = ord.status === btn.status || (ord.status === "ACCEPTED" && btn.status === "PREPARING");
                          const currentWeight = getStatusWeight(ord.status);
                          const isDisabledRollback = btn.weight < currentWeight;

                          return (
                            <button
                              key={btn.status}
                              disabled={isDisabledRollback}
                              onClick={async () => {
                                if (isDisabledRollback) return;
                                try {
                                  await updateDoc(doc(db, "orders", ord.id), { status: btn.status as any });
                                  showToast(`Order status updated to ${btn.status.replace(/_/g, " ")}`);
                                } catch (err) {
                                  console.error("Failed to update status:", err);
                                }
                              }}
                              className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition-all ${
                                isCurrent 
                                  ? "bg-brand-primary border-brand-primary text-white shadow-3xs" 
                                  : isDisabledRollback
                                    ? "bg-gray-100 dark:bg-slate-800 border-gray-100 dark:border-slate-850 text-gray-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                                    : "bg-background-secondary border-border-primary text-text-secondary hover:border-brand-primary/40 cursor-pointer"
                              }`}
                            >
                              {btn.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Secret Delivery PIN Handshake Box */}
                {["ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(ord.status) && (
                  <div className="p-6 bg-gradient-to-r from-emerald-950 via-emerald-900 to-brand-primary/20 text-white rounded-3xl border border-emerald-950 shadow-md space-y-4">
                    <div className="space-y-1">
                      <p className="text-[9px] text-emerald-300 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        <span>Resident Handshake Verification</span>
                      </p>
                      <h3 className="font-extrabold text-sm text-white">Enter Customer Delivery PIN</h3>
                      <p className="text-[10px] text-emerald-200/85 max-w-sm leading-relaxed">
                        To mark this order as completed, ask the customer for their secret 4-digit Delivery PIN once they receive the food box.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          value={enteredPin}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, "");
                            setEnteredPin(val);
                          }}
                          placeholder="Enter 4-digit code (e.g. 4821)"
                          className="w-full px-4 py-2.5 bg-slate-950/70 border border-emerald-900 text-white rounded-xl text-xs font-mono tracking-widest text-center focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        />
                        {pinError && <p className="text-[10px] text-rose-400 mt-1 font-semibold">{pinError}</p>}
                      </div>
                      <button
                        onClick={() => handleVerifyDeliveryPin(ord)}
                        className="px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-xs transition-all shrink-0 cursor-pointer"
                      >
                        Verify Handshake
                      </button>
                    </div>
                  </div>
                )}

                {/* Coordination Chat */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest pl-2">Customer Conversation</h3>
                  <Chat
                    orderId={ord.id}
                    senderId={currentProfile.uid}
                    senderName={kitchenDetails?.kitchenName || currentProfile.displayName}
                    isKitchenView={true}
                  />
                </div>
              </div>
            );
          })()
        )}

        {/* TAB 2: Menu Builder */}
        {activeTab === "menu" && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-text-primary">Menu Builder</h2>
              <p className="text-xs text-text-muted">Add, edit, or toggle dishes on your active neighborhood menu</p>
            </div>

            {/* Minimum Order Value (MOV) limit config */}
            <div className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme space-y-3">
              <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-widest">Free Delivery Threshold</h3>
              <p className="text-[10px] text-text-muted leading-relaxed font-semibold">
                Configure the Minimum Order Value (MOV) for free society delivery. Orders below this limit automatically proceed as customer Self-Pickup.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={kitchenMov}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setKitchenMov(val === '' ? 0 : parseInt(val, 10));
                    }}
                    className="w-full pl-7 pr-3 py-2 bg-background-primary border border-border-primary rounded-xl text-xs font-mono font-bold text-text-primary focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
                <button
                  onClick={handleUpdateMov}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-sm"
                >
                  Save MOV
                </button>
              </div>
            </div>

            {/* Create Menu Item Form */}
            <form onSubmit={handleAddMenuItem} className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme space-y-4">
              <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand-primary" />
                <span>Add New Menu Dish</span>
              </h3>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-semibold text-text-muted uppercase">Dish Name</label>
                  <input
                    type="text"
                    required
                    value={newDishName}
                    onChange={(e) => setNewDishName(e.target.value)}
                    placeholder="e.g. Garlic Naan"
                    className="w-full px-3 py-2 bg-background-primary border border-border-primary text-text-primary rounded-lg text-xs focus:ring-2 focus:ring-brand-primary focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-muted uppercase">Price (₹)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    required
                    value={newDishPrice}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, "");
                      const parts = val.split('.');
                      setNewDishPrice(parts.length <= 2 ? val : parts[0] + '.' + parts.slice(1).join(''));
                    }}
                    placeholder="40"
                    className="w-full px-3 py-2 bg-background-primary border border-border-primary text-text-primary rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-brand-primary focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-muted uppercase">Category</label>
                  <select
                    value={newDishCategory}
                    onChange={(e) => {
                      setNewDishCategory(e.target.value);
                      setShowAddCategory(false);
                    }}
                    className="w-full px-3 py-2 bg-background-primary border border-border-primary text-text-primary rounded-lg text-xs focus:ring-2 focus:ring-brand-primary focus:outline-hidden"
                  >
                    <option value="Main Course">Main Course</option>
                    <option value="Starters">Starters</option>
                    <option value="Breads">Breads</option>
                    <option value="Desserts">Desserts</option>
                    <option value="Snacks">Snacks</option>
                    {customCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__add_custom__">+ Add Custom Category...</option>
                  </select>
                  {newDishCategory === "__add_custom__" && (
                    <div className="flex gap-1.5 mt-1.5">
                      <input
                        type="text"
                        value={newCustomCategory}
                        onChange={(e) => setNewCustomCategory(e.target.value)}
                        placeholder="New category name"
                        className="flex-1 px-3 py-2 bg-background-primary border border-border-primary text-text-primary rounded-lg text-xs focus:ring-2 focus:ring-brand-primary focus:outline-hidden"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleAddCustomCategory();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddCustomCategory()}
                        className="px-3 py-2 bg-brand-primary text-white rounded-lg text-xs font-extrabold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-muted uppercase">Veg Preference</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setNewDishVeg(true)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        newDishVeg ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-background-primary border-border-primary text-text-muted"
                      }`}
                    >
                      Veg 🟢
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDishVeg(false)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        !newDishVeg ? "bg-rose-50 text-rose-700 border-rose-300" : "bg-background-primary border-border-primary text-text-muted"
                      }`}
                    >
                      Non-Veg 🔴
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-muted uppercase">Dietary Preferences</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDishGlutenFree(!newDishGlutenFree)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      newDishGlutenFree ? "bg-amber-50 text-amber-700 border-amber-300" : "bg-background-primary border-border-primary text-text-muted"
                    }`}
                  >
                    <span>🌾 Gluten-Free</span>
                    {newDishGlutenFree && <Check className="w-3 h-3 text-amber-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDishNutFree(!newDishNutFree)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      newDishNutFree ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-background-primary border-border-primary text-text-muted"
                    }`}
                  >
                    <span>🥜 Nut-Free</span>
                    {newDishNutFree && <Check className="w-3 h-3 text-blue-600" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-muted uppercase">Dish Description</label>
                <textarea
                  value={newDishDesc}
                  onChange={(e) => setNewDishDesc(e.target.value)}
                  placeholder="Describe your organic spices, flour, or baking ingredients..."
                  className="w-full px-3 py-2 bg-background-primary border border-border-primary text-text-primary rounded-lg text-xs min-h-[60px] focus:ring-2 focus:ring-brand-primary focus:outline-hidden"
                />
              </div>

              {/* Dish Photo Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-muted uppercase">Dish Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const base64 = await compressImage(file);
                      setNewDishImageBase64(base64);
                      showToast("Dish photo loaded and compressed! 📸");
                    } catch (err) {
                      console.error("Dish image load error:", err);
                      showToast("Failed to compress dish image.");
                    }
                  }}
                  className="w-full text-xs text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-primary-container file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer"
                />
                {newDishImageBase64 && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={newDishImageBase64} alt="Dish Preview" className="w-16 h-16 object-cover border border-border-primary rounded-lg" referrerPolicy="no-referrer" />
                    <button
                      type="button"
                      onClick={() => setNewDishImageBase64("")}
                      className="text-rose-500 text-[10px] font-bold hover:underline cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer"
              >
                Add Dish to Menu
              </button>
            </form>

            {/* List of current menu items */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest pl-2">My Menu Items ({myItems.length})</h3>
              {myItems.map((item) => (
                <div key={item.id} className="p-4 bg-background-secondary border border-border-primary rounded-3xl flex justify-between items-center shadow-theme animate-fade-in">
                  <div className="truncate pr-4 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${item.isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                      <h4 className="font-extrabold text-xs text-text-primary truncate">{item.name}</h4>
                    </div>
                    {/* Dietary Tags */}
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {item.isVeg ? (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase border border-emerald-100">
                          Veg
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-rose-50 text-rose-700 text-[8px] font-black uppercase border border-rose-100">
                          Non-Veg
                        </span>
                      )}
                      {item.isGlutenFree && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-50 text-amber-700 text-[8px] font-black uppercase border border-amber-100">
                          🌾 Gluten-Free
                        </span>
                      )}
                      {item.isNutFree && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-50 text-blue-700 text-[8px] font-black uppercase border border-blue-100">
                          🥜 Nut-Free
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted truncate font-semibold">{item.description || "No description provided."}</p>
                    <p className="font-mono text-xs text-text-primary font-extrabold">₹{item.price}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle availability */}
                    <button
                      onClick={() => toggleAvailability(item)}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border transition-all cursor-pointer ${
                        item.isAvailable
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-background-primary border-border-primary text-text-muted"
                      }`}
                    >
                      {item.isAvailable ? "Active" : "Resting"}
                    </button>

                    {/* Quick buy / place test order directly */}
                    <button
                      onClick={async () => {
                        try {
                          const orderId = "order_" + Date.now();
                          const orderData = {
                            id: orderId,
                            customerId: currentProfile.uid,
                            customerName: currentProfile.displayName || "Customer",
                            customerPhone: currentProfile.phone || "",
                            customerAddress: currentProfile.flatAddress || "",
                            kitchenId: currentProfile.uid,
                            kitchenName: kitchenDetails?.kitchenName || currentProfile.displayName,
                            items: [
                              {
                                itemId: item.id,
                                name: item.name,
                                price: item.price,
                                quantity: 1,
                                selectedAddOns: []
                              }
                            ],
                            subtotal: item.price,
                            total: item.price,
                            deliveryType: "pickup" as const,
                            status: "PENDING" as const,
                            deliveryPin: Math.floor(1000 + Math.random() * 9000).toString(),
                            createdAt: new Date().toISOString()
                          };
                          await setDoc(doc(db, "orders", orderId), orderData);
                          showToast("Quick order placed! 🎉");
                        } catch (err) {
                          console.error("Quick buy failed:", err);
                          showToast("Failed to place quick order.");
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border bg-brand-primary text-white border-brand-primary hover:bg-brand-primary/90 transition-all cursor-pointer"
                    >
                      Buy Now
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteDish(item.id)}
                      className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Feed Publisher */}
        {activeTab === "feed" && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-text-primary">Kitchen Feed</h2>
              <p className="text-xs text-text-muted">Post photos of your dishes to the neighborhood's Discover Feed</p>
            </div>

            {/* Publisher Form */}
            <form onSubmit={editingPostId ? handleUpdateFeedPost : handlePublishFeedPost} className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                  <Image className="w-4 h-4 text-brand-primary" />
                  <span>{editingPostId ? "Editing Post" : "Publish Social Post"}</span>
                </h3>
                {editingPostId && (
                  <button type="button" onClick={handleCancelEdit} className="text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-text-primary px-2.5 py-1 rounded-lg border border-border-primary hover:border-brand-primary/40 transition-all cursor-pointer">
                    Cancel
                  </button>
                )}
              </div>

              {/* File input */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-muted uppercase">Upload Fresh Dish Photo</label>
                <div className="border-2 border-dashed border-border-primary rounded-xl p-5 text-center bg-background-primary hover:border-brand-primary/40 transition-all cursor-pointer relative group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFeedFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-text-primary font-bold">Drag or choose dish image</p>
                    <p className="text-[10px] text-text-muted">Supported types: JPG, PNG • Max size auto-compressed to ≤250KB</p>
                  </div>
                </div>
              </div>

              {/* AI Image Shield sweep check section */}
              {postImageBase64 && (
                <div className="space-y-2">
                  <AIImageShield
                    fileName={postImageFile?.name || "dish_capture.jpg"}
                    dataUrl={postImageBase64}
                    onScanComplete={(result) => {
                      setIsScanningImage(false);
                      setImageApproved(result.isApproved);
                      if (!result.isApproved) {
                        showToast("⚠️ Warning: Image flagged. Please upload authentic food photography.");
                      }
                    }}
                  />
                </div>
              )}

              {/* Tag Menu Dishes */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-muted uppercase">Tag Shoppable Dishes (max 5)</label>
                <div className="border border-border-primary rounded-xl p-3 bg-background-primary max-h-[140px] overflow-y-auto space-y-1.5">
                  {myItems.length === 0 ? (
                    <p className="text-[10px] text-text-muted italic">No menu items yet. Add dishes in the Menu Builder first.</p>
                  ) : (
                    myItems.map((mi) => {
                      const checked = postTaggedItemIds.includes(mi.id);
                      const disabled = !checked && postTaggedItemIds.length >= 5;
                      return (
                        <label key={mi.id} className={`flex items-center gap-2 text-xs cursor-pointer ${disabled ? "opacity-40" : ""}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => {
                              setPostTaggedItemIds(prev =>
                                checked ? prev.filter(id => id !== mi.id) : [...prev, mi.id]
                              );
                            }}
                            className="w-3.5 h-3.5 rounded border-border-primary text-brand-primary focus:ring-brand-primary cursor-pointer"
                          />
                          <span className="font-medium text-text-primary">{mi.name}</span>
                          <span className="text-[10px] text-text-muted font-mono">₹{mi.price}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-[10px] text-text-muted">
                  {postTaggedItemIds.length}/5 selected. Tapping the post on the Discover Feed will add all tagged items to the cart.
                </p>
              </div>

              {/* AI Sparkle Tag Option */}
              <div className="flex items-center gap-2.5 p-3 bg-brand-primary-container/20 border border-brand-primary/10 rounded-xl select-none">
                <input
                  type="checkbox"
                  id="hasAiSparkle"
                  checked={hasAiSparkle}
                  onChange={(e) => setHasAiSparkle(e.target.checked)}
                  className="w-4 h-4 rounded-md border-border-primary text-brand-primary focus:ring-brand-primary cursor-pointer"
                />
                <div>
                  <label htmlFor="hasAiSparkle" className="text-xs font-bold text-text-primary flex items-center gap-1 cursor-pointer">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Apply ✨ AI Sparkle Tag</span>
                  </label>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Indicate if this dish presentation or photography is enhanced with creative AI design assistants.
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-muted uppercase">Post Caption</label>
                <textarea
                  required
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  placeholder="e.g. Freshly baked Velvet Cupcakes cooling down! Ready for lunch delivery..."
                  className="w-full px-3 py-2 bg-background-primary border border-border-primary text-text-primary rounded-lg text-xs min-h-[80px] focus:ring-2 focus:ring-brand-primary focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={!postImageBase64 || isScanningImage || !imageApproved}
                className="w-full py-3 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Publish to CP Feed</span>
              </button>
            </form>

            {/* List of my published posts */}
            <div className="space-y-5">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest pl-2">My Social Posts ({myPosts.length})</h3>
              {myPosts.length === 0 ? (
                <p className="text-xs text-text-muted italic text-center py-4 font-semibold">No published posts yet. Share your first dish above!</p>
              ) : (
                myPosts.map((post) => (
                  <article key={post.id} className="bg-background-secondary border border-border-primary rounded-3xl overflow-hidden shadow-theme animate-fade-in">
                    {/* Instagram-style header */}
                    <div className="flex items-center justify-between p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-primary/10 dark:bg-brand-primary-container flex items-center justify-center font-black text-[10px] text-brand-primary border border-brand-primary/10 shrink-0">
                          {kitchenDetails?.kitchenName?.[0] || currentProfile.displayName?.[0] || "K"}
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-text-primary leading-tight">{kitchenDetails?.kitchenName || currentProfile.displayName}</p>
                          <p className="text-[9px] text-text-muted font-bold">{new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleStartEditPost(post)} className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-all cursor-pointer" title="Edit post">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeletePost(post.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all cursor-pointer" title="Delete post">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Instagram-style square-ish image */}
                    <div className="aspect-square bg-background-primary cursor-pointer" onClick={() => setFullscreenImage(post.imageUrl)}>
                      <img src={post.imageUrl} alt={post.description} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>

                    {/* Instagram-style actions + caption */}
                    <div className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-extrabold text-text-primary flex items-center gap-1">❤️ {post.likes?.length || 0}</span>
                          {post.taggedItemIds?.length > 0 && (
                            <span className="text-[10px] text-text-muted font-bold">{post.taggedItemIds.length} tagged</span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        <span className="font-extrabold text-text-primary mr-1">{kitchenDetails?.kitchenName || currentProfile.displayName}</span>
                        {post.description}
                      </p>
                    </div>
                  </article>
                ))
              )}
            </div>

            {/* Kitchen lightbox */}
            <AnimatePresence>
              {fullscreenImage && (
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
          </div>
        )}

        {/* TAB 4: Kitchen-to-kitchen messages */}
        {activeTab === "messages" && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-text-primary">Kitchen Messages</h2>
              <p className="text-xs text-text-muted">Private kitchen-to-kitchen DMs only. Customers cannot access this space.</p>
            </div>

            <div className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-text-muted">
                  <Search className="w-4 h-4 text-brand-primary" />
                  <span>Inbox</span>
                </div>
                <input
                  type="text"
                  value={kitchenInboxMessageFilter}
                  onChange={(e) => setKitchenInboxMessageFilter(e.target.value)}
                  placeholder="Search inbox by kitchen name or handle"
                  className="w-full px-3 py-2 bg-background-primary border border-border-primary rounded-xl text-xs text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-hidden"
                />
              </div>

              <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
                {deriveInbox().length === 0 ? (
                  <div className="text-center py-10 text-text-muted text-xs font-semibold">
                    No kitchen conversations yet.
                  </div>
                ) : deriveInbox().map(({ peer, lastMessage, unreadCount }) => (
                  <button
                    key={peer.uid}
                    type="button"
                    onClick={() => setSelectedKitchenPeerId(peer.uid)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                      selectedKitchenPeerId === peer.uid
                        ? "bg-brand-primary-container border-brand-primary/30"
                        : "bg-background-primary border-border-primary hover:border-brand-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl overflow-hidden bg-background-secondary border border-border-primary flex items-center justify-center shrink-0">
                        {peer.profileImageUrl ? (
                          <img src={peer.profileImageUrl} alt={peer.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle2 className="w-6 h-6 text-text-muted" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-extrabold text-text-primary truncate">{peer.kitchenName || peer.displayName}</p>
                          {!!unreadCount && (
                            <span className="min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-text-muted font-semibold">@{peer.handle || "no-handle"}</p>
                        <p className="text-[10px] text-text-secondary truncate mt-1">
                          {lastMessage ? `${lastMessage.senderId === currentProfile.uid ? "You" : lastMessage.senderName}: ${lastMessage.text}` : "No messages yet"}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedKitchenPeerId ? (
              <div className="space-y-4">
                {(() => {
                  const peer = getSelectedKitchenPeer();
                  return peer ? (
                    <>
                      <div className="p-4 bg-background-secondary border border-border-primary rounded-3xl shadow-theme flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-background-primary border border-border-primary flex items-center justify-center shrink-0">
                            {peer.profileImageUrl ? (
                              <img src={peer.profileImageUrl} alt={peer.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <UserCircle2 className="w-6 h-6 text-text-muted" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-text-primary truncate">{peer.kitchenName || peer.displayName}</p>
                            <p className="text-[10px] text-text-muted">@{peer.handle || "no-handle"}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedKitchenPeerId(null)}
                          className="text-[10px] font-bold text-text-muted hover:text-brand-primary cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="p-4 bg-background-secondary border border-border-primary rounded-3xl shadow-theme space-y-3">
                        <div className="max-h-[360px] overflow-y-auto space-y-3 pr-1">
                          {kitchenMessages.length === 0 ? (
                            <p className="text-xs text-text-muted text-center py-8">No messages yet. Start the conversation.</p>
                          ) : (
                            kitchenMessages.map((msg) => {
                              const isMine = msg.senderId === currentProfile.uid;
                              return (
                                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs border ${
                                    isMine
                                      ? "bg-brand-primary text-white border-brand-primary"
                                      : "bg-background-primary text-text-primary border-border-primary"
                                  }`}>
                                    <p className="font-bold text-[10px] uppercase tracking-wider opacity-80 mb-1">
                                      {isMine ? "You" : msg.senderName}
                                      {msg.senderHandle ? ` • @${msg.senderHandle}` : ""}
                                    </p>
                                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <form onSubmit={handleSendKitchenMessage} className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={kitchenDmDraft}
                            onChange={(e) => setKitchenDmDraft(e.target.value)}
                            placeholder="Write a private kitchen note..."
                            className="flex-1 px-3 py-2 bg-background-primary border border-border-primary rounded-xl text-xs text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-hidden"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-black cursor-pointer flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Send
                          </button>
                        </form>
                      </div>
                    </>
                  ) : null;
                })()}
              </div>
            ) : (
              <div className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme text-center text-xs text-text-muted font-semibold">
                Pick a kitchen conversation from the inbox to open a private thread.
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Kitchen settings and operations */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-text-primary">Operating Profile</h2>
              <p className="text-xs text-text-muted">Manage your operational schedules</p>
            </div>

            {/* Kitchen Creator Profile */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveKitchenProfile(e);
              }}
              className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme space-y-4"
            >
              <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <UserCircle2 className="w-4 h-4 text-brand-primary" />
                <span>Creator Profile</span>
              </h3>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-background-primary border border-border-primary flex items-center justify-center shrink-0">
                    {kitchenProfileImageUrl ? (
                      <img src={kitchenProfileImageUrl} alt="Kitchen profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle2 className="w-7 h-7 text-text-muted" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-semibold text-text-muted uppercase">Profile Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        void uploadProfileImage(e.target.files?.[0] || null);
                      }}
                      className="w-full text-[10px] text-text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-primary-container file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-muted uppercase">Kitchen Handle</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted font-black">@</span>
                    <input
                      type="text"
                      value={kitchenHandle}
                      onChange={(e) => setKitchenHandle(e.target.value.replace(/\s+/g, "").toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                      placeholder="simrans-punjabi-tadka"
                      className="w-full pl-7 pr-3 py-2.5 bg-background-primary border border-border-primary text-text-primary rounded-xl text-xs font-mono focus:ring-2 focus:ring-brand-primary focus:outline-hidden"
                    />
                  </div>
                  <p className="text-[10px] text-text-muted font-semibold">Your public kitchen identity on the feed.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleSaveKitchenProfile()}
                className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all uppercase tracking-wider cursor-pointer"
              >
                Save Creator Profile
              </button>
            </form>

            {/* Operating Mode Countdown Toggle */}
            <div className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme space-y-4">
              <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-primary" />
                <span>Operating Schedule Mode</span>
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "online", label: "Accept Orders 🟢" },
                  { id: "break", label: "Take Break 🕒" },
                  { id: "day_off", label: "Day Off 😴" },
                  { id: "vacation", label: "Vacation Mode 🏖️" }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleUpdateOperatingMode(mode.id as any)}
                    className={`py-2 px-3.5 text-xs font-bold border rounded-xl transition-all cursor-pointer ${
                      kitchenDetails?.operatingMode === mode.id
                        ? "bg-brand-primary border-brand-primary text-white shadow-xs"
                        : "bg-background-primary border-border-primary hover:border-brand-primary/40 text-text-secondary"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kitchen Food Type */}
            <div className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme space-y-4">
              <div className="space-y-1">
                <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                  <Wheat className="w-4 h-4 text-brand-primary" />
                  <span>Kitchen Food Type</span>
                </h3>
                <p className="text-[10px] text-text-muted font-semibold leading-relaxed">
                  Veg-only kitchens can upgrade to non-veg support once, but that change is irreversible. The app will ask for your PIN before saving any change.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(["veg", "both", "non-veg"] as const).map((type) => {
                  const lockedToVeg = kitchenVegType !== "veg" && type === "veg";
                  const disabled = lockedToVeg;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setPendingVegType(type);
                        if (kitchenVegType === "veg" && type !== "veg") {
                          setShowVegUpgradeWarning(true);
                        } else {
                          void saveKitchenVegType();
                        }
                      }}
                      className={`py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                        kitchenVegType === type
                          ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                          : disabled
                            ? "bg-background-primary text-text-muted border-border-primary opacity-50 cursor-not-allowed"
                            : "bg-background-primary text-text-secondary border-border-primary hover:border-brand-primary/40"
                      }`}
                    >
                      {type === "veg" ? "Veg Only" : type === "both" ? "Veg + Non-Veg" : "Non-Veg"}
                    </button>
                  );
                })}
              </div>

              <div className="p-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-[10px] leading-relaxed">
                <strong>Important:</strong> kitchen food type changes are saved with your PIN.
              </div>
            </div>

            {/* Delivery Locations / Society Coverage Multi-Select Configuration */}
            <div className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme space-y-4 animate-fade-in">
              <div>
                <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-base">🚚</span>
                  <span>Society Delivery Coverage</span>
                </h3>
                <p className="text-[10px] text-text-muted mt-0.5 font-semibold">Toggle the societies and blocks where your kitchen delivers</p>
              </div>

              <div className="space-y-4">
                {CENTURIAN_SOCIETIES.map((soc) => {
                  const friendlyName = soc.name.replace("Centurian Park - ", "");
                  
                  // Helper to check if all blocks in this society are selected
                  const societyBlockStrings = soc.towers.map(t => `${soc.name} - ${t}`);
                  const isAllSelected = societyBlockStrings.every(str => deliveryLocations.includes(str));

                  const toggleAllSociety = () => {
                    if (isAllSelected) {
                      // Remove all
                      setDeliveryLocations(prev => prev.filter(str => !societyBlockStrings.includes(str)));
                    } else {
                      // Add missing ones
                      setDeliveryLocations(prev => {
                        const next = [...prev];
                        societyBlockStrings.forEach(str => {
                          if (!next.includes(str)) next.push(str);
                        });
                        return next;
                      });
                    }
                  };

                  return (
                    <div key={soc.name} className="p-3 bg-background-primary rounded-2xl border border-border-primary space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-extrabold text-text-primary">{friendlyName}</span>
                        <button
                          type="button"
                          onClick={toggleAllSociety}
                          className="text-[9px] text-brand-primary hover:underline font-bold uppercase tracking-wider cursor-pointer"
                        >
                          {isAllSelected ? "Clear All" : "Select All"}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {soc.towers.map((tower) => {
                          const locationKey = `${soc.name} - ${tower}`;
                          const isSelected = deliveryLocations.includes(locationKey);

                          return (
                            <button
                              key={tower}
                              type="button"
                              onClick={() => handleToggleDeliveryLocation(locationKey)}
                              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-brand-primary border-brand-primary text-white shadow-3xs"
                                  : "bg-background-secondary border-border-primary text-text-secondary hover:border-brand-primary/40"
                              }`}
                            >
                              {tower}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleSaveDeliveryLocations}
                className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all uppercase tracking-wider cursor-pointer"
              >
                Save Delivery Coverage
              </button>
            </div>

            {/* Custom Sound / Ringtone Alerts for Incoming Orders */}
            <div className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme space-y-4">
              <div>
                <h3 className="text-xs font-extrabold text-text-primary uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-lg">🔔</span>
                  <span>Order Alert Ringtone</span>
                </h3>
                <p className="text-[10px] text-text-muted mt-0.5 font-semibold">Choose a built-in alert or upload a custom audio file.</p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "Piping Hot", label: "🍳 Piping Hot" },
                    { id: "Chime", label: "✨ Elegant Chime" },
                    { id: "Doorbell", label: "🔔 Doorbell Dual" },
                    { id: "Retro", label: "📟 Retro Pager" }
                  ].map((rt) => (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() => {
                        setKitchenRingtoneMode("builtin");
                        setKitchenRingtoneChoice(rt.id);
                        localStorage.setItem("kitchen_ringtone_choice", rt.id);
                        localStorage.setItem("kitchen_ringtone_mode", "builtin");
                        void playRingtone(rt.id);
                      }}
                      className={`py-2.5 px-3 text-xs font-bold border rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                        kitchenRingtoneMode === "builtin" && kitchenRingtoneChoice === rt.id
                          ? "bg-brand-primary border-brand-primary text-white shadow-3xs"
                          : "bg-background-primary border-border-primary hover:border-brand-primary/40 text-text-secondary"
                      }`}
                    >
                      <span>{rt.label}</span>
                      {kitchenRingtoneMode === "builtin" && kitchenRingtoneChoice === rt.id && <span className="text-[10px]">⭐</span>}
                    </button>
                  ))}
                </div>

                <div className="p-4 bg-background-primary border border-border-primary rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-text-muted">
                    <UploadCloud className="w-4 h-4 text-brand-primary" />
                    <span>Custom Audio Upload</span>
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => void uploadKitchenRingtone(e.target.files?.[0] || null)}
                    className="w-full text-xs text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-primary-container file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer"
                  />
                  <p className="text-[10px] text-text-muted font-semibold">Upload MP3, WAV, or M4A. If the file fails to load, the app falls back to your built-in sound.</p>
                  {kitchenRingtoneMode === "custom" && kitchenRingtoneUrl && (
                    <div className="flex items-center gap-2 text-[10px] text-emerald-700 font-bold">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Custom ringtone is active.</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void playConfiguredRingtone()}
                    className="w-full py-2 bg-text-primary hover:bg-text-primary/95 text-text-inverse rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    🔊 Test Current Ringtone Alert
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveRingtoneProfile()}
                    className="w-full py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                    disabled={kitchenRingtoneUploading}
                  >
                    {kitchenRingtoneUploading ? "Uploading..." : "Save Ringtone"}
                  </button>
                </div>
              </div>
            </div>

            {/* [UPI REMOVED] UPI Payment Configuration form stripped */}



            {/* Resident ratings review stats */}
            <div className="p-5 bg-background-secondary border border-border-primary rounded-3xl shadow-theme space-y-4">
              <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <Star className="w-4 h-4 text-brand-primary" />
                <span>My Customer Reviews</span>
              </h3>

              {reviews.length === 0 ? (
                <p className="text-xs text-text-muted italic text-center py-2 font-semibold">No reviews left by residents yet.</p>
              ) : (
                <div className="space-y-3.5 divide-y divide-border-primary">
                  {reviews.map((rev, index) => (
                    <div key={index} className="pt-3 first:pt-0 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-text-primary">{rev.customerName}</span>
                        <div className="flex gap-0.5 text-amber-400">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="text-text-secondary italic font-semibold">"{rev.comment}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {showVegUpgradeWarning && pendingVegType && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-background-secondary border border-border-primary shadow-2xl p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Irreversible Kitchen Upgrade</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                You are changing this kitchen food type. Confirm if this is the right mode for your menu.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowVegUpgradeWarning(false);
                  setPendingVegType(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-border-primary text-text-secondary text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowVegUpgradeWarning(false);
                  const nextType = pendingVegType;
                  setPendingVegType(null);
                  if (!nextType) return;
                  if (!(await requestKitchenPin("Confirm irreversible food type upgrade?"))) return;
                  try {
                    await updateDoc(doc(db, "kitchens", currentProfile.uid), { vegType: nextType });
                    setKitchenVegType(nextType);
                    showToast(`Kitchen type updated to ${nextType.toUpperCase()}.`);
                  } catch (err) {
                    console.error("Failed to update kitchen veg type:", err);
                    showToast("Failed to update kitchen type.");
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-black"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zomato-style New Order Popup */}
      {incomingNewOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="w-full sm:max-w-md bg-background-secondary rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border-primary overflow-hidden animate-slide-up">
            {/* Header with ringtone indicator */}
            <div className="bg-gradient-to-r from-brand-primary to-brand-primary/80 p-5 text-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl animate-bounce">🔔</span>
                  <h2 className="text-sm font-black uppercase tracking-wider">New Order Incoming!</h2>
                </div>
                <span className="px-2.5 py-1 bg-white/20 rounded-full text-[9px] font-black uppercase tracking-wider">
                  {incomingNewOrder.deliveryType === "pickup" ? "Self-Pickup" : "Door Delivery"}
                </span>
              </div>
              <p className="text-[10px] text-white/80 font-semibold">
                A resident has placed an order from your kitchen
              </p>
            </div>

            {/* Customer Info */}
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border-primary">
                <div className="w-10 h-10 rounded-full bg-brand-primary-container flex items-center justify-center font-black text-sm text-brand-primary">
                  {incomingNewOrder.customerName?.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-text-primary">{incomingNewOrder.customerName}</p>
                  <p className="text-[10px] text-text-muted font-semibold">📍 {incomingNewOrder.customerAddress}</p>
                  <p className="text-[10px] text-text-muted font-semibold">📞 {incomingNewOrder.customerPhone}</p>
                </div>
              </div>

              {/* Order Items Receipt */}
              <div className="bg-background-primary rounded-2xl p-4 border border-border-primary space-y-2.5">
                <p className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest">Order Items</p>
                <div className="divide-y divide-border-primary">
                  {(incomingNewOrder.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-text-primary">{item.quantity}x</span>
                        <span className="text-xs font-semibold text-text-primary">{item.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-text-secondary">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border-primary">
                  <span className="text-xs font-extrabold text-text-primary">Total</span>
                  <span className="text-sm font-black font-mono text-brand-primary">₹{incomingNewOrder.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Scheduled Time */}
              {incomingNewOrder.scheduledTime && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-xl flex items-center gap-2">
                  <span className="text-sm">🕒</span>
                  <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                    Scheduled: {incomingNewOrder.scheduledTime.includes("T") ? new Date(incomingNewOrder.scheduledTime).toLocaleString() : incomingNewOrder.scheduledTime}
                  </p>
                </div>
              )}

              {/* Accept / Decline Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, "orders", incomingNewOrder.id), { status: "CANCELLED" });
                      showToast("Order declined.");
                      setIncomingNewOrder(null);
                    } catch (err) {
                      console.error("Error declining order:", err);
                    }
                  }}
                  className="py-3 border-2 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-extrabold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Decline ❌
                </button>
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, "orders", incomingNewOrder.id), { status: "ACCEPTED" });
                      showToast("Order accepted! Start preparing. 🍳");
                      setIncomingNewOrder(null);
                      setSelectedOrderId(incomingNewOrder.id);
                      setActiveTab("orders");
                    } catch (err) {
                      console.error("Error accepting order:", err);
                    }
                  }}
                  className="py-3 bg-brand-primary hover:bg-brand-primary/90 text-white font-extrabold rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                >
                  Accept & Prepare ✅
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kitchen Security PIN challenge modal (see requestKitchenPin) */}
      {pinPrompt && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-background-secondary border border-border-primary shadow-2xl p-5 space-y-4 animate-scale-up">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-brand-primary" />
              <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Kitchen Security PIN</h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">{pinPrompt.reason}</p>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInputValue}
              onChange={(e) => {
                setPinInputValue(e.target.value.replace(/\D/g, "").slice(0, 4));
                if (pinInputError) setPinInputError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitPinPrompt();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  resolvePinPrompt(false);
                }
              }}
              placeholder="••••"
              className="w-full text-center text-lg tracking-[0.5em] font-black px-4 py-3 rounded-2xl border border-border-primary bg-background-primary text-text-primary focus:border-brand-primary focus:outline-none"
            />
            {pinInputError && <p className="text-[11px] text-rose-500 font-semibold">{pinInputError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => resolvePinPrompt(false)}
                className="flex-1 py-2.5 rounded-xl border border-border-primary text-text-secondary text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitPinPrompt}
                className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-black cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation Tabs */}
      {!selectedOrderId && (
        <nav data-testid="nav-kitchen" className="fixed bottom-0 inset-x-0 bg-background-secondary/95 backdrop-blur-md border-t border-border-primary p-2 py-3 flex justify-around items-center z-40 shadow-theme">
          {[
            { id: "orders", label: "Orders", icon: "📋" },
            { id: "menu", label: "Menu", icon: "📖" },
            { id: "feed", label: "My Feed", icon: "📸" },
            { id: "messages", label: "DMs", icon: "💬" },
            { id: "settings", label: "Settings", icon: "⚙️" }
          ].map((tab) => (
            <button
              key={tab.id}
              data-testid={["orders", "menu", "feed"].includes(tab.id) ? `nav-kitchen-${tab.id}` : undefined}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedOrderId(null);
              }}
              className="flex flex-col items-center gap-1 cursor-pointer group relative w-12"
            >
              <div className={`text-xl transition-transform group-hover:scale-110 ${activeTab === tab.id ? "scale-110 text-brand-primary" : "text-text-muted"}`}>
                {tab.icon}
              </div>
              {tab.id === "orders" && activeOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white ring-2 ring-white animate-pulse">
                  {activeOrdersCount}
                </span>
              )}
              <span className={`text-[9px] font-extrabold tracking-tight uppercase ${activeTab === tab.id ? "text-brand-primary" : "text-text-muted"}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
