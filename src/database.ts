import { supabase } from './supabase';
import { UserProfile, KitchenDetails, MenuItem, FeedPost, Order, ChatMessage, KitchenDirectMessage, PostComment, Follow, Review } from './types';
import { normalizePayload, resolveColumn } from './db';

export type { UserProfile, KitchenDetails, MenuItem, FeedPost, Order, ChatMessage, KitchenDirectMessage, PostComment, Follow, Review };

class DatabaseService {
  constructor() {
    // Always use Supabase
  }

  async initialize() {
    console.log('Database service initialized with Supabase');
  }

  // ---------- Users ----------
  async getUser(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
      if (error) throw error;
      return this.mapToUserProfile(data);
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async createUser(user: Partial<UserProfile>): Promise<UserProfile> {
    if (!user.uid) throw new Error('User ID is required');

    // Only include fields that are actually provided to avoid schema errors
    const userData: any = {
      id: user.uid,
      email: user.email,
      name: user.displayName,
      role: user.role,
      phone: user.phone,
      society: user.society,
      flatAddress: user.flatAddress,
      myGateId: user.myGateId,
      myGateScreenshot: user.myGateScreenshot,
      status: user.status,
      created_at: new Date(user.createdAt || Date.now()).toISOString()
    };

    // Only add optional fields if they exist
    if (user.securityPin !== undefined) userData.securityPin = user.securityPin;
    if (user.handle !== undefined) userData.handle = user.handle;
    if (user.profileImageUrl !== undefined) userData.profileImageUrl = user.profileImageUrl;
    if (user.themePreference !== undefined) userData.themePreference = user.themePreference;

    const { data, error } = await supabase.from('users').insert(normalizePayload('users', [userData])).select().single();
    if (error) throw error;
    return this.mapToUserProfile(data);
  }

  async updateUser(userId: string, updates: Partial<UserProfile>): Promise<void> {
    const { error } = await supabase.from('users').update(normalizePayload('users', {
      name: updates.displayName,
      role: updates.role,
      phone: updates.phone,
      society: updates.society,
      flatAddress: updates.flatAddress,
      myGateId: updates.myGateId,
      myGateScreenshot: updates.myGateScreenshot,
      status: updates.status,
      securityPin: updates.securityPin,
      handle: updates.handle,
      profileImageUrl: updates.profileImageUrl,
      themePreference: updates.themePreference
    })).eq('id', userId);
    if (error) throw error;
  }

  async listUsersByRole(role: string): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('role', role);
      if (error) throw error;
      return data.map(this.mapToUserProfile);
    } catch (error) {
      console.error('Error listing users:', error);
      return [];
    }
  }

  async listVerifiedKitchens(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('role', 'kitchen').eq('status', 'verified');
      if (error) throw error;
      return data.map(this.mapToUserProfile);
    } catch (error) {
      console.error('Error listing kitchens:', error);
      return [];
    }
  }

  // ---------- Kitchens ----------
  async getKitchen(kitchenId: string): Promise<KitchenDetails | null> {
    try {
      const { data, error } = await supabase.from('kitchens').select('*').eq('id', kitchenId).single();
      if (error) throw error;
      return this.mapToKitchenDetails(data);
    } catch (error) {
      console.error('Error getting kitchen:', error);
      return null;
    }
  }

  async createKitchen(kitchen: KitchenDetails): Promise<void> {
    const { error } = await supabase.from('kitchens').insert(normalizePayload('kitchens', [{
      id: kitchen.uid,
      kitchenName: kitchen.kitchenName,
      handle: kitchen.handle,
      profileImageUrl: kitchen.profileImageUrl,
      ringtoneMode: kitchen.ringtoneMode,
      ringtoneChoice: kitchen.ringtoneChoice,
      ringtoneUrl: kitchen.ringtoneUrl,
      vegType: kitchen.vegType,
      mov: kitchen.mov,
      isOnline: kitchen.isOnline,
      restingUntil: kitchen.restingUntil,
      operatingMode: kitchen.operatingMode,
      cuisineType: kitchen.cuisineType,
      society: kitchen.society,
      flatAddress: kitchen.flatAddress,
      deliveryLocations: kitchen.deliveryLocations,
      securityPin: kitchen.securityPin,
      customCategories: kitchen.customCategories || []
    }]));
    if (error) throw error;
  }

  async updateKitchen(kitchenId: string, updates: Partial<KitchenDetails>): Promise<void> {
    const { error } = await supabase.from('kitchens').update(normalizePayload('kitchens', {
      kitchenName: updates.kitchenName,
      handle: updates.handle,
      profileImageUrl: updates.profileImageUrl,
      ringtoneMode: updates.ringtoneMode,
      ringtoneChoice: updates.ringtoneChoice,
      ringtoneUrl: updates.ringtoneUrl,
      vegType: updates.vegType,
      mov: updates.mov,
      isOnline: updates.isOnline,
      restingUntil: updates.restingUntil,
      operatingMode: updates.operatingMode,
      cuisineType: updates.cuisineType,
      society: updates.society,
      flatAddress: updates.flatAddress,
      deliveryLocations: updates.deliveryLocations,
      securityPin: updates.securityPin,
      customCategories: updates.customCategories
    })).eq('id', kitchenId);
    if (error) throw error;
  }

  async listKitchens(): Promise<KitchenDetails[]> {
    try {
      const { data, error } = await supabase.from('kitchens').select('*');
      if (error) throw error;
      return data.map(this.mapToKitchenDetails);
    } catch (error) {
      console.error('Error listing kitchens:', error);
      return [];
    }
  }

  // ---------- Menu Items ----------
  async getMenuItems(kitchenId?: string): Promise<MenuItem[]> {
    try {
      let query = supabase.from('menu_items').select('*');
      if (kitchenId) query = query.eq(resolveColumn('menu_items', 'kitchenId'), kitchenId);
      const { data, error } = await query.order(resolveColumn('menu_items', 'createdAt'), { ascending: false });
      if (error) throw error;
      return data.map(this.mapToMenuItem);
    } catch (error) {
      console.error('Error getting menu items:', error);
      return [];
    }
  }

  async createMenuItem(item: MenuItem): Promise<MenuItem> {
    const { data, error } = await supabase.from('menu_items').insert(normalizePayload('menu_items', [{
      id: item.id,
      kitchenId: item.kitchenId,
      name: item.name,
      description: item.description,
      price: item.price,
      isVeg: item.isVeg,
      isGlutenFree: item.isGlutenFree,
      isNutFree: item.isNutFree,
      isAvailable: item.isAvailable,
      category: item.category,
      createdAt: new Date(item.createdAt).toISOString(),
      imageUrl: item.imageUrl,
      addOnGroups: item.addOnGroups
    }])).select().single();
    if (error) throw error;
    return this.mapToMenuItem(data);
  }

  async updateMenuItem(itemId: string, updates: Partial<MenuItem>): Promise<void> {
    const { error } = await supabase.from('menu_items').update(normalizePayload('menu_items', {
      name: updates.name,
      description: updates.description,
      price: updates.price,
      isVeg: updates.isVeg,
      isGlutenFree: updates.isGlutenFree,
      isNutFree: updates.isNutFree,
      isAvailable: updates.isAvailable,
      category: updates.category,
      imageUrl: updates.imageUrl,
      addOnGroups: updates.addOnGroups
    })).eq('id', itemId);
    if (error) throw error;
  }

  async deleteMenuItem(itemId: string): Promise<void> {
    const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
    if (error) throw error;
  }

  // ---------- Feed Posts ----------
  async getFeedPosts(): Promise<FeedPost[]> {
    try {
      const { data, error } = await supabase.from('feed_posts').select('*').order(resolveColumn('feed_posts', 'createdAt'), { ascending: false });
      if (error) throw error;
      return data.map(this.mapToFeedPost);
    } catch (error) {
      console.error('Error getting feed posts:', error);
      return [];
    }
  }

  async createFeedPost(post: FeedPost): Promise<void> {
    const { error } = await supabase.from('feed_posts').insert(normalizePayload('feed_posts', [{
      id: post.id,
      kitchenId: post.kitchenId,
      kitchenName: post.kitchenName,
      description: post.description,
      imageUrl: post.imageUrl,
      likes: post.likes,
      taggedItemIds: post.taggedItemIds || [],
      createdAt: new Date(post.createdAt).toISOString(),
      hasAiSparkle: post.hasAiSparkle,
      aiSparkleImposed: post.aiSparkleImposed
    }]));
    if (error) throw error;
  }

  async deleteFeedPost(postId: string): Promise<void> {
    const { error } = await supabase.from('feed_posts').delete().eq('id', postId);
    if (error) throw error;
  }

  async updateFeedPostLikes(postId: string, likes: string[]): Promise<void> {
    const { error } = await supabase.from('feed_posts').update({ likes }).eq('id', postId);
    if (error) throw error;
  }

  async updateFeedPostAiSparkle(postId: string, aiSparkleImposed: boolean): Promise<void> {
    const { error } = await supabase.from('feed_posts').update({ aiSparkleImposed }).eq('id', postId);
    if (error) throw error;
  }

  // ---------- Orders ----------
  async createOrder(order: Order): Promise<Order> {
    const { data, error } = await supabase.from('orders').insert(normalizePayload('orders', [{
      id: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      kitchenId: order.kitchenId,
      kitchenName: order.kitchenName,
      items: order.items,
      subtotal: order.subtotal,
      total: order.total,
      deliveryType: order.deliveryType,
      status: order.status,
      deliveryPin: order.deliveryPin,
      createdAt: new Date(order.createdAt).toISOString(),
      scheduledTime: order.scheduledTime
    }])).select().single();
    if (error) throw error;
    return this.mapToOrder(data);
  }

  async getOrdersByKitchen(kitchenId: string): Promise<Order[]> {
    try {
      const { data, error } = await supabase.from('orders').select('*').eq(resolveColumn('orders', 'kitchenId'), kitchenId).order(resolveColumn('orders', 'createdAt'), { ascending: false });
      if (error) throw error;
      return data.map(this.mapToOrder);
    } catch (error) {
      console.error('Error getting kitchen orders:', error);
      return [];
    }
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    try {
      const { data, error } = await supabase.from('orders').select('*').eq(resolveColumn('orders', 'customerId'), customerId).order(resolveColumn('orders', 'createdAt'), { ascending: false });
      if (error) throw error;
      return data.map(this.mapToOrder);
    } catch (error) {
      console.error('Error getting customer orders:', error);
      return [];
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) throw error;
  }

  // ---------- Favorites ----------
  async toggleFavorite(userId: string, item: MenuItem): Promise<void> {
    const favId = `fav_${userId}_${item.id}`;
    const existing = await this.getFavorite(favId);
    if (existing) {
      const { error } = await supabase.from('favorites').delete().eq('id', favId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('favorites').insert(normalizePayload('favorites', [{
        id: favId,
        userId,
        menuItemId: item.id,
        kitchenId: item.kitchenId,
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl || '',
        isVeg: item.isVeg,
        createdAt: new Date().toISOString()
      }]));
      if (error) throw error;
    }
  }

  async getFavorite(favId: string): Promise<any | null> {
    const { data, error } = await supabase.from('favorites').select('*').eq('id', favId).single();
    if (error) return null;
    return data;
  }

  async getFavorites(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase.from('favorites').select('*').eq(resolveColumn('favorites', 'userId'), userId);
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting favorites:', error);
      return [];
    }
  }

  // ---------- Follows ----------
  async toggleFollow(userId: string, kitchenId: string): Promise<void> {
    const followId = `follow_${userId}_${kitchenId}`;
    const existing = await this.getFollow(followId);
    if (existing) {
      const { error } = await supabase.from('follows').delete().eq('id', followId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('follows').insert(normalizePayload('follows', [{ id: followId, followerId: userId, kitchenId, createdAt: new Date().toISOString() }]));
      if (error) throw error;
    }
  }

  async getFollow(followId: string): Promise<any | null> {
    const { data, error } = await supabase.from('follows').select('*').eq('id', followId).single();
    if (error) return null;
    return data;
  }

  async getFollows(userId: string): Promise<Follow[]> {
    try {
      const { data, error } = await supabase.from('follows').select('*').eq(resolveColumn('follows', 'followerId'), userId);
      if (error) throw error;
      return data.map(d => ({ id: d.id, followerId: d.followerId, kitchenId: d.kitchenId, createdAt: new Date(d.createdAt).getTime() } as Follow));
    } catch (error) {
      console.error('Error getting follows:', error);
      return [];
    }
  }

  // ---------- Comments ----------
  async createComment(comment: PostComment): Promise<void> {
    const { error } = await supabase.from('comments').insert(normalizePayload('comments', [{
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      userName: comment.userName,
      userRole: comment.userRole,
      text: comment.text,
      createdAt: new Date(comment.createdAt).toISOString(),
      kitchenId: comment.kitchenId
    }]));
    if (error) throw error;
  }

  async getComments(postId: string): Promise<PostComment[]> {
    try {
      const { data, error } = await supabase.from('comments').select('*').eq(resolveColumn('comments', 'postId'), postId);
      if (error) throw error;
      return data.map(this.mapToPostComment);
    } catch (error) {
      console.error('Error getting comments:', error);
      return [];
    }
  }

  async getAllComments(): Promise<PostComment[]> {
    try {
      const { data, error } = await supabase.from('comments').select('*');
      if (error) throw error;
      return data.map(this.mapToPostComment);
    } catch (error) {
      console.error('Error getting all comments:', error);
      return [];
    }
  }

  // ---------- Reviews ----------
  async createReview(review: Review): Promise<void> {
    const { error } = await supabase.from('reviews').insert(normalizePayload('reviews', [{
      id: review.id,
      orderId: review.orderId,
      customerId: review.customerId,
      customerName: review.customerName,
      kitchenId: review.kitchenId,
      rating: review.rating,
      comment: review.comment,
      createdAt: new Date(review.createdAt).toISOString(),
      isHandpicked: review.isHandpicked,
      taggedItemIds: review.taggedItemIds
    }]));
    if (error) throw error;
  }

  async getReviews(kitchenId: string): Promise<Review[]> {
    try {
      const { data, error } = await supabase.from('reviews').select('*').eq(resolveColumn('reviews', 'kitchenId'), kitchenId);
      if (error) throw error;
      return data.map(this.mapToReview);
    } catch (error) {
      console.error('Error getting reviews:', error);
      return [];
    }
  }

  async getAllReviews(): Promise<Review[]> {
    try {
      const { data, error } = await supabase.from('reviews').select('*');
      if (error) throw error;
      return data.map(this.mapToReview);
    } catch (error) {
      console.error('Error getting all reviews:', error);
      return [];
    }
  }

  async deleteReview(reviewId: string): Promise<void> {
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
    if (error) throw error;
  }

  // ---------- Notifications ----------
  async createNotification(notification: any): Promise<void> {
    const { error } = await supabase.from('notifications').insert(normalizePayload('notifications', [notification]));
    if (error) throw error;
  }

  async getNotifications(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase.from('notifications').select('*').eq(resolveColumn('notifications', 'userId'), userId).order(resolveColumn('notifications', 'createdAt'), { ascending: false });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    if (error) throw error;
  }

  // ---------- Chats ----------
  async createChatMessage(message: ChatMessage): Promise<void> {
    const { error } = await supabase.from('chats').insert(normalizePayload('chats', [{
      id: message.id,
      orderId: message.orderId,
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text,
      createdAt: new Date(message.createdAt).toISOString()
    }]));
    if (error) throw error;
  }

  async getChatMessages(orderId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase.from('chats').select('*').eq(resolveColumn('chats', 'orderId'), orderId).order(resolveColumn('chats', 'createdAt'), { ascending: true });
      if (error) throw error;
      return data.map(this.mapToChatMessage);
    } catch (error) {
      console.error('Error getting chat messages:', error);
      return [];
    }
  }

  // ---------- Kitchen DMs ----------
  async createKitchenDM(message: KitchenDirectMessage): Promise<void> {
    const { error } = await supabase.from('kitchen_chats').insert(normalizePayload('kitchen_chats', [{
      id: message.id,
      conversationId: message.conversationId,
      participants: message.participants,
      senderId: message.senderId,
      senderName: message.senderName,
      senderHandle: message.senderHandle,
      recipientId: message.recipientId,
      recipientName: message.recipientName,
      recipientHandle: message.recipientHandle,
      text: message.text,
      createdAt: new Date(message.createdAt).toISOString()
    }]));
    if (error) throw error;
  }

  async getKitchenDMs(conversationId: string): Promise<KitchenDirectMessage[]> {
    try {
      const { data, error } = await supabase.from('kitchen_chats').select('*').eq(resolveColumn('kitchen_chats', 'conversationId'), conversationId).order(resolveColumn('kitchen_chats', 'createdAt'), { ascending: true });
      if (error) throw error;
      return data.map(this.mapToKitchenDM);
    } catch (error) {
      console.error('Error getting kitchen DMs:', error);
      return [];
    }
  }

  async getKitchenInbox(userId: string): Promise<KitchenDirectMessage[]> {
    try {
      const { data, error } = await supabase.from('kitchen_chats').select('*').contains('participants', [userId]).order(resolveColumn('kitchen_chats', 'createdAt'), { ascending: false }).limit(100);
      if (error) throw error;
      return data.map(this.mapToKitchenDM);
    } catch (error) {
      console.error('Error getting kitchen inbox:', error);
      return [];
    }
  }

  // ---------- Address Registry ----------
  async getAddressRegistry(addressId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase.from('address_registry').select('*').eq('id', addressId).single();
      if (error) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  async setAddressRegistry(addressId: string, data: any): Promise<void> {
    const { error } = await supabase.from('address_registry').upsert(normalizePayload('address_registry', { id: addressId, ...data }));
    if (error) throw error;
  }

  // ---------- Handle Registry ----------
  async getHandleRegistry(handleId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase.from('handle_registry').select('*').eq('id', handleId).single();
      if (error) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  async setHandleRegistry(handleId: string, data: any): Promise<void> {
    const { error } = await supabase.from('handle_registry').upsert(normalizePayload('handle_registry', { id: handleId, ...data }));
    if (error) throw error;
  }

  // ---------- Mappers ----------
  private mapToUserProfile(data: any): UserProfile {
    return {
      uid: data.id,
      email: data.email,
      displayName: data.name || data.displayName || 'User',
      handle: data.handle,
      profileImageUrl: data.profileImageUrl,
      role: data.role || 'customer',
      phone: data.phone || '',
      society: data.society || '',
      flatAddress: data.flatAddress || '',
      myGateId: data.myGateId || '',
      myGateScreenshot: data.myGateScreenshot,
      status: data.status || 'pending',
      securityPin: data.securityPin,
      themePreference: data.themePreference,
      createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now()
    };
  }

  private mapToKitchenDetails(data: any): KitchenDetails {
    return {
      uid: data.id,
      kitchenName: data.kitchenName,
      handle: data.handle,
      profileImageUrl: data.profileImageUrl,
      ringtoneMode: data.ringtoneMode,
      ringtoneChoice: data.ringtoneChoice,
      ringtoneUrl: data.ringtoneUrl,
      vegType: data.vegType || 'veg',
      mov: data.mov || 100,
      isOnline: data.isOnline !== false,
      restingUntil: data.restingUntil,
      operatingMode: data.operatingMode || 'online',
      cuisineType: data.cuisineType || '',
      society: data.society,
      flatAddress: data.flatAddress,
      deliveryLocations: data.deliveryLocations,
      securityPin: data.securityPin,
      customCategories: Array.isArray(data.customCategories) ? data.customCategories : []
    };
  }

  private mapToMenuItem(data: any): MenuItem {
    return {
      id: data.id,
      kitchenId: data.kitchenId,
      name: data.name,
      description: data.description || '',
      price: data.price,
      isVeg: data.isVeg !== false,
      isGlutenFree: data.isGlutenFree === true,
      isNutFree: data.isNutFree === true,
      isAvailable: data.isAvailable !== false,
      category: data.category || 'Other',
      createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
      imageUrl: data.imageUrl,
      addOnGroups: data.addOnGroups ? (typeof data.addOnGroups === 'string' ? (() => { try { return JSON.parse(data.addOnGroups); } catch { return []; } })() : data.addOnGroups) : undefined
    };
  }

  private mapToFeedPost(data: any): FeedPost {
    const likes = typeof data.likes === 'string' ? (() => { try { return JSON.parse(data.likes); } catch { return []; } })() : data.likes || [];
    const taggedItemIds = Array.isArray(data.taggedItemIds)
      ? data.taggedItemIds
      : typeof data.taggedItemIds === 'string'
        ? (() => { try { return JSON.parse(data.taggedItemIds); } catch { return []; } })()
        : [];
    return {
      id: data.id,
      kitchenId: data.kitchenId,
      kitchenName: data.kitchenName,
      description: data.description,
      imageUrl: data.imageUrl,
      likes,
      taggedItemIds,
      createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
      hasAiSparkle: data.hasAiSparkle === true,
      aiSparkleImposed: data.aiSparkleImposed === true
    };
  }

  private mapToOrder(data: any): Order {
    return {
      id: data.id,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      kitchenId: data.kitchenId,
      kitchenName: data.kitchenName,
      items: typeof data.items === 'string' ? (() => { try { return JSON.parse(data.items); } catch { return []; } })() : data.items || [],
      subtotal: data.subtotal,
      total: data.total,
      deliveryType: data.deliveryType || 'delivery',
      status: data.status,
      deliveryPin: data.deliveryPin,
      createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
      scheduledTime: data.scheduledTime
    };
  }

  private mapToChatMessage(data: any): ChatMessage {
    return {
      id: data.id,
      orderId: data.orderId,
      senderId: data.senderId,
      senderName: data.senderName,
      text: data.text,
      createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now()
    };
  }

  private mapToKitchenDM(data: any): KitchenDirectMessage {
    return {
      id: data.id,
      conversationId: data.conversationId,
      participants: typeof data.participants === 'string' ? (() => { try { return JSON.parse(data.participants); } catch { return []; } })() : data.participants || [],
      senderId: data.senderId,
      senderName: data.senderName,
      senderHandle: data.senderHandle,
      recipientId: data.recipientId,
      recipientName: data.recipientName,
      recipientHandle: data.recipientHandle,
      text: data.text,
      createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now()
    };
  }

  private mapToPostComment(data: any): PostComment {
    return {
      id: data.id,
      postId: data.postId,
      userId: data.userId,
      userName: data.userName,
      userRole: data.userRole,
      text: data.text,
      createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
      kitchenId: data.kitchenId
    };
  }

  private mapToReview(data: any): Review {
    return {
      id: data.id,
      orderId: data.orderId,
      customerId: data.customerId,
      customerName: data.customerName,
      kitchenId: data.kitchenId,
      rating: data.rating,
      comment: data.comment || '',
      createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
      isHandpicked: data.isHandpicked === true,
      taggedItemIds: typeof data.taggedItemIds === 'string' ? (() => { try { return JSON.parse(data.taggedItemIds); } catch { return []; } })() : data.taggedItemIds
    };
  }
}

const databaseService = new DatabaseService();

export { databaseService, DatabaseService };