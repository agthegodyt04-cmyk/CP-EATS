import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, onSnapshot, deleteField } from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile, KitchenDetails, MenuItem, FeedPost, Order } from "../types";
import { Plus, Trash2, Clipboard, Check, Shield, MessageSquare, AlertTriangle, LogOut, Clock, Layers, Star, Settings, Image, CheckCircle, ChevronRight, ArrowLeft, ToggleLeft, ToggleRight, Sun, Moon, Sparkles, Wheat } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"orders" | "menu" | "feed" | "settings">("orders");
  const [kitchenDetails, setKitchenDetails] = useState<KitchenDetails | null>(null);
  const [myItems, setMyItems] = useState<MenuItem[]>([]);
  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  // Sound & Ringtone customisation states
  const prevOrdersLoadedRef = React.useRef(false);
  const [customRingtone, setCustomRingtone] = useState(localStorage.getItem("kitchen_ringtone_choice") || "Piping Hot");

  // Navigation Selection
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

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
  const [postTaggedItemId, setPostTaggedItemId] = useState("");
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImageBase64, setPostImageBase64] = useState<string | null>(null);
  const [isScanningImage, setIsScanningImage] = useState(false);
  const [imageApproved, setImageApproved] = useState(false);
  const [hasAiSparkle, setHasAiSparkle] = useState(false);

  // Delivery Pin state
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");

  // UPI configuration drawer state
  const [upiId, setUpiId] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiDisplayName, setUpiDisplayName] = useState("");
  const [hardDeleteUpi, setHardDeleteUpi] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  // Stats / Operating limits
  const [kitchenMov, setKitchenMov] = useState(100);
  const [deliveryLocations, setDeliveryLocations] = useState<string[]>([]);

  // Visual feedback Toast
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2500);
  };

  const handleToggleTheme = async () => {
    const nextTheme = currentProfile.themePreference === "dark" ? "light" : "dark";
    try {
      await updateDoc(doc(db, "users", currentProfile.uid), {
        themePreference: nextTheme
      });
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
      }
    });

    // 2. Fetch chef's menu items
    const qMenu = query(collection(db, "menu_items"), where("kitchenId", "==", chefId));
    const unsubMenu = onSnapshot(qMenu, (snap) => {
      const list: MenuItem[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as MenuItem));
      setMyItems(list);
    });

    // 3. Fetch chef's published feed posts
    const qPosts = query(collection(db, "feed_posts"), where("kitchenId", "==", chefId));
    const unsubPosts = onSnapshot(qPosts, (snap) => {
      const list: FeedPost[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as FeedPost));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setMyPosts(list);
    });

    // 4. Fetch incoming orders
    const qOrders = query(collection(db, "orders"), where("kitchenId", "==", chefId));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const list: Order[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Order));
      list.sort((a, b) => b.createdAt - a.createdAt);

      let hasAddedOrder = false;
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          hasAddedOrder = true;
        }
      });

      if (hasAddedOrder && prevOrdersLoadedRef.current) {
        const activeChoice = localStorage.getItem("kitchen_ringtone_choice") || "Piping Hot";
        playRingtone(activeChoice);
      }

      prevOrdersLoadedRef.current = true;
      setIncomingOrders(list);
    });

    // 5. Fetch reviews left for this kitchen
    const qReviews = query(collection(db, "reviews"), where("kitchenId", "==", chefId));
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setReviews(list);
    });

    return () => {
      unsubKitchen();
      unsubMenu();
      unsubPosts();
      unsubOrders();
      unsubReviews();
    };
  }, [currentProfile.uid]);

  // Handle menu item add
  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentProfile.status === "Pending_Verification") {
      showToast("⚠️ Cannot create menu items. Your profile is Pending MyGate Verification.");
      return;
    }

    const price = parseFloat(newDishPrice);
    if (!newDishName.trim() || isNaN(price) || price <= 0) return;

    try {
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
        createdAt: Date.now(),
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
      // Find the document to update. We used addDoc so we need to query by id
      const q = query(collection(db, "menu_items"), where("id", "==", item.id));
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
      const q = query(collection(db, "menu_items"), where("id", "==", itemId));
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
      await updateDoc(doc(db, "kitchens", currentProfile.uid), { mov: kitchenMov });
      showToast("Minimum Order Value (MOV) updated! ₹" + kitchenMov);
    } catch (err) {
      console.error("Failed to update kitchen MOV:", err);
    }
  };

  // Update kitchen delivery coverage locations
  const handleSaveDeliveryLocations = async () => {
    try {
      await updateDoc(doc(db, "kitchens", currentProfile.uid), {
        deliveryLocations: deliveryLocations
      });
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
      await updateDoc(doc(db, "kitchens", currentProfile.uid), {
        operatingMode: mode,
        isOnline: mode === "online"
      });
      showToast(`Operating mode updated to: ${mode.toUpperCase()} 🕒`);
    } catch (err) {
      console.error("Failed to update operating mode:", err);
    }
  };

  // Update UPI credentials drawer
  const handleSaveUpiProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
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
    if (currentProfile.status === "Pending_Verification") {
      showToast("⚠️ Cannot publish feed posts. Your profile is Pending MyGate Verification.");
      return;
    }

    if (!postImageBase64 || !imageApproved) return;

    const taggedItem = myItems.find(mi => mi.id === postTaggedItemId);

    const customPostId = "post_" + Date.now();
    try {
      await setDoc(doc(db, "feed_posts", customPostId), {
        id: customPostId,
        kitchenId: currentProfile.uid,
        kitchenName: kitchenDetails?.kitchenName || currentProfile.displayName,
        description: postDescription.trim(),
        imageUrl: postImageBase64,
        likes: [],
        taggedItemId: taggedItem ? taggedItem.id : null,
        taggedItemName: taggedItem ? taggedItem.name : null,
        taggedItemPrice: taggedItem ? taggedItem.price : null,
        createdAt: Date.now(),
        hasAiSparkle: hasAiSparkle,
        aiSparkleImposed: false
      });

      // Clear states
      setPostDescription("");
      setPostTaggedItemId("");
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
      const q = query(collection(db, "feed_posts"), where("id", "==", postId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, "feed_posts", snap.docs[0].id));
        showToast("Social post deleted.");
      }
    } catch (err) {
      console.error("Failed to delete post:", err);
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
        createdAt: Date.now()
      });

      showToast("Secure UPI request card sent to chat! 💳");
    } catch (err) {
      console.error("Failed to send billing invoice:", err);
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-800 dark:text-slate-100 pb-20 transition-colors duration-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-2xl shadow-lg z-50 flex items-center gap-2 animate-scale-up">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-30 shadow-xs">
        <div 
          onClick={() => {
            setSelectedOrderId(null);
            setActiveTab("orders");
          }}
          className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity"
          title="Go to Orders Board"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center font-black text-white text-lg tracking-wider">
            🍳
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-gray-950 dark:text-slate-100 uppercase">{kitchenDetails?.kitchenName || currentProfile.displayName}</h1>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 font-medium">Verified Centurian Kitchen Seller</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleTheme}
            className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
            title={currentProfile.themePreference === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {currentProfile.themePreference === "dark" ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-gray-500" />
            )}
          </button>

          <button
            onClick={onLogout}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Pending MyGate verification notice banner */}
      {currentProfile.status === "Pending_Verification" && (
        <div id="pending-verification-banner" className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center gap-3 text-amber-800 dark:text-amber-400">
          <div className="p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <span className="text-sm">⚠️</span>
          </div>
          <div className="flex-1 text-[11px] leading-normal font-medium">
            <span className="font-bold">MyGate Verification Pending:</span> Your resident kitchen profile is currently undergoing verification by a Trustee Admin. Creating menu items or publishing feed posts is barred until approved.
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-5 space-y-6">

        {/* TAB 1: Kitchen Orders Dashboard */}
        {activeTab === "orders" && !selectedOrderId && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-gray-950">Incoming Orders</h2>
              <p className="text-xs text-gray-400">Validate deliveries using Customer Delivery PIN codes</p>
            </div>

            {/* Quick stats panel */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center space-y-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Today's Orders</p>
                <p className="text-xl font-black text-indigo-600">
                  {incomingOrders.filter(o => o.status !== "CANCELLED").length} active
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center space-y-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Estimated Revenue</p>
                <p className="text-xl font-black text-emerald-600">
                  ₹{incomingOrders.filter(o => o.status === "COMPLETED").reduce((sum, o) => sum + o.total, 0).toFixed(2)}
                </p>
              </div>
            </div>

            {incomingOrders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-gray-100">
                <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">No incoming orders yet</p>
                <p className="text-xs text-gray-400 mt-1">Once a neighbor orders from your menu, it registers here in real-time!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {incomingOrders.map((ord) => (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrderId(ord.id)}
                    className="p-5 bg-white rounded-3xl border border-gray-100 shadow-3xs hover:shadow-2xs transition-all cursor-pointer flex justify-between items-center animate-fade-in"
                  >
                    <div className="space-y-2 pr-4 truncate">
                      <div>
                        <h3 className="font-bold text-xs text-gray-950 truncate">
                          {ord.customerName} ({ord.customerAddress.split(",")[1]?.trim() || "Flat"})
                        </h3>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {ord.items.length} items • ₹{ord.total}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[9px] bg-slate-50 border border-gray-100 text-gray-600 px-1.5 py-0.5 rounded-sm font-mono">
                          {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider">
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
                      <p className="text-[9px] text-gray-400">Review & Chat →</p>
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
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 font-semibold cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to incoming orders</span>
                </button>

                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-3xs space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-sm font-black text-gray-950 uppercase">Order from {ord.customerName}</h2>
                      <p className="text-[10px] text-gray-400 font-medium">📍 Address: {ord.customerAddress}</p>
                      <p className="text-[10px] text-gray-400 font-medium">📞 Phone: {ord.customerPhone}</p>
                      {ord.scheduledTime && (
                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold mt-1.5 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/35 px-2 py-0.5 rounded-md inline-block">
                          🕒 Scheduled: {ord.scheduledTime.includes("T") ? new Date(ord.scheduledTime).toLocaleString() : ord.scheduledTime}
                        </p>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                      ord.deliveryType === "pickup" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"
                    }`}>
                      {ord.deliveryType}
                    </span>
                  </div>

                  <hr className="border-gray-50" />

                  {/* Items list */}
                  <div className="space-y-2 text-xs">
                    {ord.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-gray-700">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="font-mono text-gray-600">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-3 text-sm font-extrabold text-gray-900 border-t border-gray-100">
                      <span>Customer Payable Total</span>
                      <span className="font-mono text-indigo-700">₹{ord.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Actions (Accept/Cancel) */}
                  {ord.status === "PENDING" && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => handleCancelOrder(ord)}
                        className="py-2 border border-gray-200 hover:bg-gray-50 text-rose-600 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                      >
                        Decline Order
                      </button>
                      <button
                        onClick={() => handleAcceptOrder(ord)}
                        className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer"
                      >
                        Accept & Prepare
                      </button>
                    </div>
                  )}

                  {/* Status update controller */}
                  {["ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(ord.status) && (
                    <div className="bg-slate-50 rounded-2xl p-4 border border-gray-100 space-y-3 pt-3">
                      <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">Update Order Progress Status</p>
                      
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
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-3xs" 
                                  : isDisabledRollback
                                    ? "bg-gray-100 dark:bg-slate-800 border-gray-100 dark:border-slate-850 text-gray-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                                    : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:border-gray-300 cursor-pointer"
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
                  <div className="p-6 bg-gradient-to-r from-emerald-950 to-indigo-950 text-white rounded-3xl border border-emerald-950 shadow-md space-y-4">
                    <div className="space-y-1">
                      <p className="text-[9px] text-emerald-300 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        <span>Resident Handshake Verification</span>
                      </p>
                      <h3 className="font-extrabold text-sm text-white">Enter Customer Delivery PIN</h3>
                      <p className="text-[10px] text-emerald-200/85 max-w-sm">
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
                        className="px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all shrink-0 cursor-pointer"
                      >
                        Verify Handshake
                      </button>
                    </div>
                  </div>
                )}

                {/* Coordination Chat & Request Payment */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Customer Conversation & billing</h3>
                  <Chat
                    orderId={ord.id}
                    senderId={currentProfile.uid}
                    senderName={kitchenDetails?.kitchenName || currentProfile.displayName}
                    isKitchenView={true}
                    onSendUpiRequest={handleSendBillingRequest}
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
              <h2 className="text-xl font-extrabold tracking-tight text-gray-950">Menu Builder</h2>
              <p className="text-xs text-gray-400">Add, edit, or toggle dishes on your active neighborhood menu</p>
            </div>

            {/* Minimum Order Value (MOV) limit config */}
            <div className="p-5 bg-white border border-gray-100 rounded-3xl shadow-3xs space-y-3">
              <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Free Delivery Threshold</h3>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Configure the Minimum Order Value (MOV) for free society delivery. Orders below this limit automatically proceed as customer Self-Pickup.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₹</span>
                  <input
                    type="number"
                    value={kitchenMov}
                    onChange={(e) => setKitchenMov(parseInt(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={handleUpdateMov}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Save MOV
                </button>
              </div>
            </div>

            {/* Create Menu Item Form */}
            <form onSubmit={handleAddMenuItem} className="p-5 bg-white border border-gray-100 rounded-3xl shadow-3xs space-y-4">
              <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Add New Menu Dish</span>
              </h3>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Dish Name</label>
                  <input
                    type="text"
                    required
                    value={newDishName}
                    onChange={(e) => setNewDishName(e.target.value)}
                    placeholder="e.g. Garlic Naan"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={newDishPrice}
                    onChange={(e) => setNewDishPrice(e.target.value)}
                    placeholder="40"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Category</label>
                  <select
                    value={newDishCategory}
                    onChange={(e) => setNewDishCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
                  >
                    <option value="Main Course">Main Course</option>
                    <option value="Starters">Starters</option>
                    <option value="Breads">Breads</option>
                    <option value="Desserts">Desserts</option>
                    <option value="Snacks">Snacks</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Veg Preference</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setNewDishVeg(true)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        newDishVeg ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-white border-gray-100"
                      }`}
                    >
                      Veg 🟢
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDishVeg(false)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        !newDishVeg ? "bg-rose-50 text-rose-700 border-rose-300" : "bg-white border-gray-100"
                      }`}
                    >
                      Non-Veg 🔴
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Dietary Preferences</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDishGlutenFree(!newDishGlutenFree)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      newDishGlutenFree ? "bg-amber-50 text-amber-700 border-amber-300" : "bg-white border-gray-100"
                    }`}
                  >
                    <span>🌾 Gluten-Free</span>
                    {newDishGlutenFree && <Check className="w-3 h-3 text-amber-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDishNutFree(!newDishNutFree)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      newDishNutFree ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-white border-gray-100"
                    }`}
                  >
                    <span>🥜 Nut-Free</span>
                    {newDishNutFree && <Check className="w-3 h-3 text-blue-600" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Dish Description</label>
                <textarea
                  value={newDishDesc}
                  onChange={(e) => setNewDishDesc(e.target.value)}
                  placeholder="Describe your organic spices, flour, or baking ingredients..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs min-h-[60px]"
                />
              </div>

              {/* Dish Photo Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Dish Photo (Optional)</label>
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
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {newDishImageBase64 && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={newDishImageBase64} alt="Dish Preview" className="w-16 h-16 object-cover border border-gray-100 rounded-lg" referrerPolicy="no-referrer" />
                    <button
                      type="button"
                      onClick={() => setNewDishImageBase64("")}
                      className="text-rose-500 text-[10px] font-bold"
                    >
                      Remove Photo
                    </button>
                  </div>
                )}
              </div>

              {currentProfile.status === "Pending_Verification" ? (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center space-y-1">
                  <p className="text-xs font-bold text-amber-800">⚠️ Account Verification Pending</p>
                  <p className="text-[10px] text-amber-600">
                    Adding new dishes is barred until a Trustee Admin verifies your MyGate resident status.
                  </p>
                </div>
              ) : (
                <button
                  type="submit"
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  Add Dish to Menu
                </button>
              )}
            </form>

            {/* List of current menu items */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">My Menu Items ({myItems.length})</h3>
              {myItems.map((item) => (
                <div key={item.id} className="p-4 bg-white border border-gray-100 rounded-2xl flex justify-between items-center shadow-3xs animate-fade-in">
                  <div className="truncate pr-4 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${item.isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                      <h4 className="font-bold text-xs text-gray-950 truncate">{item.name}</h4>
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
                    <p className="text-[10px] text-gray-400 truncate">{item.description || "No description provided."}</p>
                    <p className="font-mono text-xs text-gray-950 font-extrabold">₹{item.price}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle availability */}
                    <button
                      onClick={() => toggleAvailability(item)}
                      className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition-all cursor-pointer ${
                        item.isAvailable
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-gray-100 border-gray-200 text-gray-400"
                      }`}
                    >
                      {item.isAvailable ? "Active" : "Resting"}
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
              <h2 className="text-xl font-extrabold tracking-tight text-gray-950">Kitchen Feed Feed</h2>
              <p className="text-xs text-gray-400">Post photos of your dishes to the neighborhood's Discover Feed</p>
            </div>

            {/* Publisher Form */}
            <form onSubmit={handlePublishFeedPost} className="p-5 bg-white border border-gray-100 rounded-3xl shadow-3xs space-y-4">
              <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Image className="w-4 h-4 text-indigo-600" />
                <span>Publish Social Post</span>
              </h3>

              {/* File input */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Upload Fresh Dish Photo</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center bg-gray-50/50 hover:bg-gray-50 hover:border-indigo-400 transition-all cursor-pointer relative group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFeedFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600 font-bold">Drag or choose dish image</p>
                    <p className="text-[10px] text-gray-400">Supported types: JPG, PNG • Max size auto-compressed to ≤250KB</p>
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

              {/* Tag Menu Dish */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Tag Shoppable Dish (Required)</label>
                <select
                  required
                  value={postTaggedItemId}
                  onChange={(e) => setPostTaggedItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose dish to link --</option>
                  {myItems.map((mi) => (
                    <option key={mi.id} value={mi.id}>{mi.name} • ₹{mi.price}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400">
                  Tapping this post on the Discover Feed will instantly add this tagged item to the customer's cart.
                </p>
              </div>

              {/* AI Sparkle Tag Option */}
              <div className="flex items-center gap-2.5 p-3 bg-indigo-50/40 dark:bg-slate-800/20 border border-indigo-100/50 dark:border-slate-800 rounded-xl select-none">
                <input
                  type="checkbox"
                  id="hasAiSparkle"
                  checked={hasAiSparkle}
                  onChange={(e) => setHasAiSparkle(e.target.checked)}
                  className="w-4 h-4 rounded-md border-gray-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <label htmlFor="hasAiSparkle" className="text-xs font-bold text-indigo-950 dark:text-slate-200 flex items-center gap-1 cursor-pointer">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Apply ✨ AI Sparkle Tag</span>
                  </label>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                    Indicate if this dish presentation or photography is enhanced with creative AI design assistants.
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Post Caption</label>
                <textarea
                  required
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  placeholder="e.g. Freshly baked Velvet Cupcakes cooling down! Ready for lunch delivery..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs min-h-[80px]"
                />
              </div>

              {currentProfile.status === "Pending_Verification" ? (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center space-y-1">
                  <p className="text-xs font-bold text-amber-800">⚠️ Account Verification Pending</p>
                  <p className="text-[10px] text-amber-600">
                    Publishing feed posts is barred until a Trustee Admin verifies your MyGate resident status.
                  </p>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={!postImageBase64 || isScanningImage || !imageApproved}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Publish to CP Feed</span>
                </button>
              )}
            </form>

            {/* List of my published posts */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">My Social Posts ({myPosts.length})</h3>
              {myPosts.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-4">No published posts.</p>
              ) : (
                myPosts.map((post) => (
                  <div key={post.id} className="p-4 bg-white border border-gray-100 rounded-2xl flex justify-between items-start gap-4 shadow-3xs animate-fade-in">
                    <img
                      src={post.imageUrl}
                      alt="Published Dish"
                      className="w-16 h-16 object-cover rounded-xl border border-gray-100 bg-gray-50 shrink-0"
                    />

                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs text-gray-700 leading-snug line-clamp-2 font-medium">"{post.description}"</p>
                      {post.taggedItemName && (
                        <span className="inline-block px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-[9px] uppercase rounded-md">
                          [@] Tagged: {post.taggedItemName}
                        </span>
                      )}
                      <p className="text-[10px] text-gray-400">{post.likes.length} verification likes</p>
                    </div>

                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Kitchen settings, UPI, and operations */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-extrabold tracking-tight text-gray-950">Operating Profile</h2>
              <p className="text-xs text-gray-400">Manage payment coordinates and operational schedules</p>
            </div>

            {/* Operating Mode Countdown Toggle */}
            <div className="p-5 bg-white border border-gray-100 rounded-3xl shadow-3xs space-y-4">
              <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
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
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                        : "bg-white border-gray-100 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery Locations / Society Coverage Multi-Select Configuration */}
            <div className="p-5 bg-white border border-gray-100 rounded-3xl shadow-3xs space-y-4 animate-fade-in">
              <div>
                <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-base">🚚</span>
                  <span>Society Delivery Coverage</span>
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Toggle the societies and blocks where your kitchen delivers</p>
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
                    <div key={soc.name} className="p-3 bg-slate-50 rounded-2xl border border-gray-50 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-extrabold text-gray-900">{friendlyName}</span>
                        <button
                          type="button"
                          onClick={toggleAllSociety}
                          className="text-[9px] text-indigo-600 hover:underline font-bold uppercase tracking-wider"
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
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-3xs"
                                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
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
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-3xs hover:shadow-2xs transition-all uppercase tracking-wider cursor-pointer"
              >
                Save Delivery Coverage
              </button>
            </div>

            {/* Custom Sound / Ringtone Alerts for Incoming Orders */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-3xs space-y-4">
              <div>
                <h3 className="text-xs font-extrabold text-gray-950 dark:text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-lg">🔔</span>
                  <span>Order Alert Ringtone</span>
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Customize and test the synthesizer sound triggered upon receiving new orders</p>
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
                        setCustomRingtone(rt.id);
                        localStorage.setItem("kitchen_ringtone_choice", rt.id);
                        playRingtone(rt.id);
                      }}
                      className={`py-2.5 px-3 text-xs font-bold border rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                        customRingtone === rt.id
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-3xs"
                          : "bg-gray-50/50 dark:bg-slate-850/40 border-gray-100 dark:border-slate-850 hover:bg-gray-100/50 text-gray-700 dark:text-slate-300"
                      }`}
                    >
                      <span>{rt.label}</span>
                      {customRingtone === rt.id && <span className="text-[10px]">⭐</span>}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => playRingtone(customRingtone)}
                  className="w-full py-2 bg-slate-950 hover:bg-slate-900 text-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  🔊 Test Current Ringtone Alert
                </button>
              </div>
            </div>

            {/* UPI configurations Form */}
            <form onSubmit={handleSaveUpiProfile} className="p-5 bg-white border border-gray-100 rounded-3xl shadow-3xs space-y-4">
              <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-indigo-600" />
                <span>UPI Payment Configuration</span>
              </h3>

              <p className="text-[10px] text-gray-400 leading-relaxed">
                Configure your peer payment destination. Customers will copy these credentials in chat to settle orders. Toggle on the Hard Delete button to instantly wipe all payment details from the database.
              </p>

              <div className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">UPI Handle / ID</label>
                  <input
                    type="text"
                    required={!hardDeleteUpi}
                    disabled={hardDeleteUpi}
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. chefname@upi"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-gray-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Beneficiary Display Name</label>
                  <input
                    type="text"
                    required={!hardDeleteUpi}
                    disabled={hardDeleteUpi}
                    value={upiDisplayName}
                    onChange={(e) => setUpiDisplayName(e.target.value)}
                    placeholder="e.g. Simranjeet Kaur"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Bank Name</label>
                  <input
                    type="text"
                    required={!hardDeleteUpi}
                    disabled={hardDeleteUpi}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Save QR Code Image (Pic)</label>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={hardDeleteUpi}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const base64 = await compressImage(file);
                        setQrCodeUrl(base64);
                        showToast("QR Code picture loaded! 📸 Click Save Payout Settings below to finalize.");
                      } catch (err) {
                        console.error("QR upload error:", err);
                        showToast("Failed to upload/compress QR Code.");
                      }
                    }}
                    className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {qrCodeUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16 object-cover border border-gray-100 rounded-lg" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => setQrCodeUrl("")}
                        className="text-rose-500 text-[10px] font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <div className="space-y-0.5 pr-4">
                    <p className="text-[10px] font-bold text-rose-600 uppercase">Hard Wipe Payment Profiles</p>
                    <p className="text-[9px] text-gray-400">Permanently hard-delete all payment settings from Firestore records.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHardDeleteUpi(!hardDeleteUpi)}
                    className="p-1 text-rose-500 hover:scale-110 transition-transform cursor-pointer shrink-0"
                  >
                    {hardDeleteUpi ? (
                      <ToggleRight className="w-10 h-10 text-rose-500 fill-current" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-gray-300" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-2.5 rounded-xl text-xs font-bold shadow-3xs transition-all ${
                  hardDeleteUpi ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                {hardDeleteUpi ? "Confirm Hard Wipe Details" : "Save Payout Profile"}
              </button>
            </form>

            {/* Resident ratings review stats */}
            <div className="p-5 bg-white border border-gray-100 rounded-3xl shadow-3xs space-y-4">
              <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Star className="w-4 h-4 text-indigo-600" />
                <span>My Customer Reviews</span>
              </h3>

              {reviews.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-2">No reviews left by residents yet.</p>
              ) : (
                <div className="space-y-3.5 divide-y divide-gray-50">
                  {reviews.map((rev, index) => (
                    <div key={index} className="pt-3 first:pt-0 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800">{rev.customerName}</span>
                        <div className="flex gap-0.5 text-amber-400">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-600 italic">"{rev.comment}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation Tabs */}
      {!selectedOrderId && (
        <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-100 p-2 py-3 flex justify-around items-center z-40 shadow-lg">
          {[
            { id: "orders", label: "Orders", icon: "📋" },
            { id: "menu", label: "Menu", icon: "📖" },
            { id: "feed", label: "My Feed", icon: "📸" },
            { id: "settings", label: "Settings", icon: "⚙️" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedOrderId(null);
              }}
              className="flex flex-col items-center gap-1 cursor-pointer group relative w-12"
            >
              <div className={`text-xl transition-transform group-hover:scale-110 ${activeTab === tab.id ? "scale-110 text-indigo-600" : "text-gray-400"}`}>
                {tab.icon}
              </div>
              {tab.id === "orders" && activeOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white ring-2 ring-white animate-pulse">
                  {activeOrdersCount}
                </span>
              )}
              <span className={`text-[9px] font-bold tracking-tight uppercase ${activeTab === tab.id ? "text-indigo-600" : "text-gray-400"}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
