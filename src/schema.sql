-- Turso / SQLite schema for CP EATS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'customer',
  phone TEXT DEFAULT '',
  society TEXT DEFAULT '',
  flatAddress TEXT DEFAULT '',
  myGateId TEXT DEFAULT '',
  myGateScreenshot TEXT,
  status TEXT DEFAULT 'pending',
  securityPin TEXT DEFAULT '',
  themePreference TEXT DEFAULT 'light',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kitchens (
  id TEXT PRIMARY KEY,
  kitchenName TEXT NOT NULL,
  handle TEXT,
  profileImageUrl TEXT DEFAULT '',
  ringtoneMode TEXT DEFAULT 'builtin',
  ringtoneChoice TEXT DEFAULT 'Piping Hot',
  ringtoneUrl TEXT DEFAULT '',
  vegType TEXT DEFAULT 'veg',
  mov INTEGER DEFAULT 100,
  isOnline INTEGER DEFAULT 1,
  restingUntil INTEGER,
  operatingMode TEXT DEFAULT 'online',
  cuisineType TEXT DEFAULT '',
  society TEXT,
  flatAddress TEXT,
  deliveryLocations TEXT DEFAULT '[]',
  securityPin TEXT DEFAULT '',
  customCategories TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  kitchenId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  isVeg INTEGER DEFAULT 1,
  isGlutenFree INTEGER DEFAULT 0,
  isNutFree INTEGER DEFAULT 0,
  isAvailable INTEGER DEFAULT 1,
  category TEXT DEFAULT 'Other',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  imageUrl TEXT DEFAULT '',
  addOnGroups TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS feed_posts (
  id TEXT PRIMARY KEY,
  kitchenId TEXT NOT NULL,
  kitchenName TEXT NOT NULL,
  description TEXT NOT NULL,
  imageUrl TEXT NOT NULL,
  likes TEXT DEFAULT '[]',
  taggedItemId TEXT,
  taggedItemName TEXT,
  taggedItemPrice REAL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  hasAiSparkle INTEGER DEFAULT 0,
  aiSparkleImposed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  customerName TEXT NOT NULL,
  customerPhone TEXT NOT NULL,
  customerAddress TEXT NOT NULL,
  kitchenId TEXT NOT NULL,
  kitchenName TEXT NOT NULL,
  items TEXT NOT NULL,
  subtotal REAL NOT NULL,
  total REAL NOT NULL,
  deliveryType TEXT DEFAULT 'delivery',
  status TEXT DEFAULT 'PENDING',
  deliveryPin TEXT NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  scheduledTime TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  menuItemId TEXT NOT NULL,
  kitchenId TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  imageUrl TEXT DEFAULT '',
  isVeg INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  followerId TEXT NOT NULL,
  kitchenId TEXT NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  postId TEXT NOT NULL,
  userId TEXT NOT NULL,
  userName TEXT NOT NULL,
  userRole TEXT NOT NULL,
  text TEXT NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  kitchenId TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  customerId TEXT NOT NULL,
  customerName TEXT NOT NULL,
  kitchenId TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  isHandpicked INTEGER DEFAULT 0,
  taggedItemIds TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  title TEXT DEFAULT '',
  text TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  senderId TEXT NOT NULL,
  senderName TEXT NOT NULL,
  text TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kitchen_chats (
  id TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL,
  participants TEXT NOT NULL,
  senderId TEXT NOT NULL,
  senderName TEXT NOT NULL,
  senderHandle TEXT DEFAULT '',
  recipientId TEXT NOT NULL,
  recipientName TEXT NOT NULL,
  recipientHandle TEXT DEFAULT '',
  text TEXT NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS address_registry (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  email TEXT,
  role TEXT,
  flatAddress TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS handle_registry (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  email TEXT,
  handle TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kitchen_chats_conversation ON kitchen_chats(conversationId);
CREATE INDEX IF NOT EXISTS idx_kitchen_chats_participants ON kitchen_chats(participants);
CREATE INDEX IF NOT EXISTS idx_orders_kitchen ON orders(kitchenId);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customerId);
CREATE INDEX IF NOT EXISTS idx_feed_posts_kitchen ON feed_posts(kitchenId);
CREATE INDEX IF NOT EXISTS idx_menu_items_kitchen ON menu_items(kitchenId);
CREATE INDEX IF NOT EXISTS idx_reviews_kitchen ON reviews(kitchenId);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(userId);
CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(followerId);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(postId);
CREATE INDEX IF NOT EXISTS idx_chats_order ON chats(orderId);
