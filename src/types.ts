export type UserRole = "customer" | "kitchen" | "admin";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  handle?: string;
  profileImageUrl?: string;
  role: UserRole;
  phone: string;
  society: string;
  flatAddress: string; // Concatenated formatted address
  myGateId: string;
  myGateScreenshot?: string;
  status: "pending" | "verified" | "banned" | "Pending_Verification";
  upiId?: string;
  bankName?: string;
  upiDisplayName?: string;
  qrCodeUrl?: string;
  securityPin?: string;
  themePreference?: "light" | "dark";
  createdAt: number | string;
}

export interface KitchenDetails {
  uid: string;
  kitchenName: string;
  handle?: string;
  profileImageUrl?: string;
  ringtoneMode?: "builtin" | "custom";
  ringtoneChoice?: string;
  ringtoneUrl?: string;
  vegType: "veg" | "non-veg" | "both";
  mov: number; // Minimum Order Value
  isOnline: boolean;
  restingUntil: number | null; // Epoch millisecond time when they are back
  operatingMode: "online" | "break" | "day_off" | "vacation";
  upiId: string;
  bankName: string;
  upiDisplayName: string;
  qrCodeUrl: string; // Base64 data URL
  cuisineType: string;
  society?: string;
  flatAddress?: string;
  deliveryLocations?: string[];
  securityPin?: string;
  customCategories?: string[];
}

export interface AddOnOption {
  id: string;
  name: string;
  price: number;
}

export interface AddOnGroup {
  id: string;
  title: string; // e.g. "Choose Condiments", "Select Quantity/Size", "Spiciness Level"
  minSelections: number; // e.g. 0 for optional, 1 for required
  maxSelections: number; // e.g. 1 for radio, or multiple for checkboxes
  options: AddOnOption[];
}

export interface MenuItem {
  id: string;
  kitchenId: string;
  name: string;
  description: string;
  price: number;
  isVeg: boolean;
  isGlutenFree?: boolean;
  isNutFree?: boolean;
  isAvailable: boolean;
  category: string;
  createdAt: number;
  addOnGroups?: AddOnGroup[]; // Customizable add-ons like Zomato
  imageUrl?: string;
}

export interface FeedPost {
  id: string;
  kitchenId: string;
  kitchenName: string;
  description: string;
  imageUrl: string; // Base64 data URL (compressed to <= 250KB)
  likes: string[]; // List of user UIDs who liked
  taggedItemId: string | null;
  taggedItemName: string | null;
  taggedItemPrice: number | null;
  createdAt: number;
  hasAiSparkle?: boolean;
  aiSparkleImposed?: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  text: string;
  createdAt: number;
  kitchenId: string;
}

export interface Follow {
  id: string;
  followerId: string;
  kitchenId: string;
  createdAt: number | string;
}

export type OrderStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "COMPLETED" | "CANCELLED";

export interface SelectedAddOn {
  groupId: string;
  groupTitle: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface OrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedAddOns?: SelectedAddOn[]; // Selected add-ons for the item
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  kitchenId: string;
  kitchenName: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  deliveryType: "delivery" | "pickup";
  status: OrderStatus;
  deliveryPin: string; // 4-digit code
  createdAt: number;
  scheduledTime?: string;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderName: string;
  text: string;
  isUpiCard?: boolean;
  upiCardData?: {
    upiId: string;
    amount: number;
    displayName: string;
    bankName?: string;
  } | null;
  qrCodeUrl?: string;
  createdAt: number | string;
}

export interface KitchenDirectMessage {
  id: string;
  conversationId: string;
  participants: string[];
  senderId: string;
  senderName: string;
  senderHandle?: string;
  recipientId: string;
  recipientName: string;
  recipientHandle?: string;
  text: string;
  createdAt: number | string;
}

export interface Review {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  kitchenId: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: number;
  isHandpicked?: boolean; // Featured/handpicked review on kitchen's profile wall
  taggedItemIds?: string[]; // IDs of menu items mentioned or tagged in this review
}
