-- Supabase schema for CP EATS
-- Run this full file in Supabase Dashboard > SQL Editor.
-- Important: camelCase column names are quoted because Postgres lowercases
-- unquoted identifiers, but the app writes camelCase fields through Supabase.

-- Migration: upgrade existing feed_posts from single tagged item to multi-tag arrays
ALTER TABLE IF EXISTS feed_posts
  DROP COLUMN IF EXISTS "taggedItemName",
  DROP COLUMN IF EXISTS "taggedItemPrice",
  ADD COLUMN IF NOT EXISTS "taggedItemIds" TEXT[] DEFAULT '{}';
ALTER TABLE IF EXISTS feed_posts
  DROP COLUMN IF EXISTS "taggedItemId";

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'customer',
  phone TEXT DEFAULT '',
  society TEXT DEFAULT '',
  "flatAddress" TEXT DEFAULT '',
  "myGateId" TEXT DEFAULT '',
  "myGateScreenshot" TEXT,
  status TEXT DEFAULT 'pending',
  "upiId" TEXT,
  "bankName" TEXT,
  "upiDisplayName" TEXT,
  "qrCodeUrl" TEXT,
  "securityPin" TEXT,
  handle TEXT DEFAULT '',
  "profileImageUrl" TEXT DEFAULT '',
  "themePreference" TEXT DEFAULT 'light',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kitchens (
  id TEXT PRIMARY KEY,
  "kitchenName" TEXT NOT NULL,
  handle TEXT UNIQUE,
  "profileImageUrl" TEXT,
  "ringtoneMode" TEXT DEFAULT 'builtin',
  "ringtoneChoice" TEXT DEFAULT 'Piping Hot',
  "ringtoneUrl" TEXT DEFAULT '',
  "vegType" TEXT DEFAULT 'veg',
  mov INTEGER DEFAULT 100,
  "isOnline" BOOLEAN DEFAULT TRUE,
  "restingUntil" TEXT,
  "operatingMode" TEXT DEFAULT 'online',
  "upiId" TEXT,
  "bankName" TEXT,
  "upiDisplayName" TEXT,
  "qrCodeUrl" TEXT,
  "cuisineType" TEXT DEFAULT '',
  society TEXT,
  "flatAddress" TEXT,
  "deliveryLocations" JSONB DEFAULT '[]',
  "securityPin" TEXT,
  "customCategories" TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  "kitchenId" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  "isVeg" BOOLEAN DEFAULT TRUE,
  "isGlutenFree" BOOLEAN DEFAULT FALSE,
  "isNutFree" BOOLEAN DEFAULT FALSE,
  "isAvailable" BOOLEAN DEFAULT TRUE,
  category TEXT DEFAULT 'Other',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "imageUrl" TEXT,
  "addOnGroups" JSONB
);

CREATE TABLE IF NOT EXISTS feed_posts (
  id TEXT PRIMARY KEY,
  "kitchenId" TEXT NOT NULL,
  "kitchenName" TEXT NOT NULL,
  description TEXT DEFAULT '',
  "imageUrl" TEXT,
  likes TEXT[] DEFAULT '{}',
  "taggedItemId" TEXT,
  "taggedItemName" TEXT,
  "taggedItemPrice" REAL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "hasAiSparkle" BOOLEAN DEFAULT FALSE,
  "aiSparkleImposed" BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerAddress" TEXT NOT NULL,
  "kitchenId" TEXT NOT NULL,
  "kitchenName" TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal REAL NOT NULL,
  total REAL NOT NULL,
  "deliveryType" TEXT DEFAULT 'delivery',
  status TEXT DEFAULT 'PENDING',
  "deliveryPin" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "scheduledTime" TEXT
);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "menuItemId" TEXT NOT NULL,
  "kitchenId" TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  "imageUrl" TEXT DEFAULT '',
  "isVeg" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  "followerId" TEXT NOT NULL,
  "kitchenId" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  "userRole" TEXT NOT NULL,
  text TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "kitchenId" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "kitchenId" TEXT NOT NULL,
  rating REAL NOT NULL,
  comment TEXT DEFAULT '',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "isHandpicked" BOOLEAN DEFAULT FALSE,
  "taggedItemIds" JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  text TEXT NOT NULL,
  "isUpiCard" BOOLEAN DEFAULT FALSE,
  "upiCardData" JSONB,
  "qrCodeUrl" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kitchen_chats (
  id TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  participants JSONB NOT NULL DEFAULT '[]',
  "senderId" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "senderHandle" TEXT DEFAULT '',
  "recipientId" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientHandle" TEXT DEFAULT '',
  text TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS address_registry (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  "flatAddress" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handle_registry (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  email TEXT NOT NULL,
  handle TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Upgrade existing tables that were created before new MVP fields existed,
-- or created with unquoted camelCase names that Postgres lowercased.
ALTER TABLE users ADD COLUMN IF NOT EXISTS "flatAddress" TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "myGateId" TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "myGateScreenshot" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "upiDisplayName" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "qrCodeUrl" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "securityPin" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS handle TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "themePreference" TEXT DEFAULT 'light';

ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "kitchenName" TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS handle TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "ringtoneMode" TEXT DEFAULT 'builtin';
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "ringtoneChoice" TEXT DEFAULT 'Piping Hot';
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "ringtoneUrl" TEXT DEFAULT '';
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "vegType" TEXT DEFAULT 'veg';
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS mov INTEGER DEFAULT 100;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN DEFAULT TRUE;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "restingUntil" TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "operatingMode" TEXT DEFAULT 'online';
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "upiDisplayName" TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "qrCodeUrl" TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "cuisineType" TEXT DEFAULT '';
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS society TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "flatAddress" TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "deliveryLocations" JSONB DEFAULT '[]';
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "securityPin" TEXT;

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS "kitchenId" TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS "isVeg" BOOLEAN DEFAULT TRUE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS "isGlutenFree" BOOLEAN DEFAULT FALSE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS "isNutFree" BOOLEAN DEFAULT FALSE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN DEFAULT TRUE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Other';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS "addOnGroups" JSONB;

ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS "kitchenId" TEXT;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS "kitchenName" TEXT;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS likes TEXT[] DEFAULT '{}';
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS "taggedItemId" TEXT;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS "taggedItemName" TEXT;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS "taggedItemPrice" REAL;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS "hasAiSparkle" BOOLEAN DEFAULT FALSE;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS "aiSparkleImposed" BOOLEAN DEFAULT FALSE;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "kitchenId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "kitchenName" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "deliveryType" TEXT DEFAULT 'delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "deliveryPin" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "scheduledTime" TEXT;

ALTER TABLE favorites ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS "menuItemId" TEXT;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS "kitchenId" TEXT;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS "imageUrl" TEXT DEFAULT '';
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS "isVeg" BOOLEAN DEFAULT TRUE;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE follows ADD COLUMN IF NOT EXISTS "followerId" TEXT;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS "kitchenId" TEXT;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE comments ADD COLUMN IF NOT EXISTS "postId" TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS "userName" TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS "userRole" TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE comments ADD COLUMN IF NOT EXISTS "kitchenId" TEXT;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "kitchenId" TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "isHandpicked" BOOLEAN DEFAULT FALSE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "taggedItemIds" JSONB DEFAULT '[]';

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE chats ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS "senderId" TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS "senderName" TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS "isUpiCard" BOOLEAN DEFAULT FALSE;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS "upiCardData" JSONB;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS "qrCodeUrl" TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE kitchen_chats ADD COLUMN IF NOT EXISTS "conversationId" TEXT;
ALTER TABLE kitchen_chats ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]';
ALTER TABLE kitchen_chats ADD COLUMN IF NOT EXISTS "senderId" TEXT;
ALTER TABLE kitchen_chats ADD COLUMN IF NOT EXISTS "senderName" TEXT;
ALTER TABLE kitchen_chats ADD COLUMN IF NOT EXISTS "senderHandle" TEXT DEFAULT '';
ALTER TABLE kitchen_chats ADD COLUMN IF NOT EXISTS "recipientId" TEXT;
ALTER TABLE kitchen_chats ADD COLUMN IF NOT EXISTS "recipientName" TEXT;
ALTER TABLE kitchen_chats ADD COLUMN IF NOT EXISTS "recipientHandle" TEXT DEFAULT '';
ALTER TABLE kitchen_chats ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE address_registry ADD COLUMN IF NOT EXISTS "flatAddress" TEXT;
ALTER TABLE address_registry ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE handle_registry ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- If earlier setup used unquoted camelCase, Postgres created lowercase columns
-- such as kitchenname/kitchenid. They can block new writes if still NOT NULL.
DO $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('kitchens', 'kitchenname'),
      ('menu_items', 'kitchenid'),
      ('feed_posts', 'kitchenid'),
      ('feed_posts', 'kitchenname'),
      ('orders', 'customerid'),
      ('orders', 'customername'),
      ('orders', 'customerphone'),
      ('orders', 'customeraddress'),
      ('orders', 'kitchenid'),
      ('orders', 'kitchenname'),
      ('favorites', 'userid'),
      ('favorites', 'menuitemid'),
      ('favorites', 'kitchenid'),
      ('follows', 'followerid'),
      ('follows', 'kitchenid'),
      ('comments', 'postid'),
      ('comments', 'userid'),
      ('comments', 'username'),
      ('comments', 'userrole'),
      ('comments', 'kitchenid'),
      ('reviews', 'orderid'),
      ('reviews', 'customerid'),
      ('reviews', 'customername'),
      ('reviews', 'kitchenid'),
      ('notifications', 'userid'),
      ('chats', 'orderid'),
      ('chats', 'senderid'),
      ('chats', 'sendername'),
      ('kitchen_chats', 'conversationid'),
      ('kitchen_chats', 'senderid'),
      ('kitchen_chats', 'sendername'),
      ('kitchen_chats', 'recipientid'),
      ('kitchen_chats', 'recipientname'),
      ('address_registry', 'flataddress')
    ) AS t(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = item.table_name
        AND column_name = item.column_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', item.table_name, item.column_name);
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_kitchen ON orders("kitchenId");
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders("customerId");
CREATE INDEX IF NOT EXISTS idx_menu_items_kitchen ON menu_items("kitchenId");
CREATE INDEX IF NOT EXISTS idx_feed_posts_kitchen ON feed_posts("kitchenId");
CREATE INDEX IF NOT EXISTS idx_chats_order ON chats("orderId");
CREATE INDEX IF NOT EXISTS idx_kitchen_chats_conversation ON kitchen_chats("conversationId");
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments("postId");
CREATE INDEX IF NOT EXISTS idx_reviews_kitchen ON reviews("kitchenId");
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites("userId");
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows("followerId");

NOTIFY pgrst, 'reload schema';
