-- CP EATS kitchen writes repair migration
--
-- Run this in Supabase Dashboard > SQL Editor if kitchen saves still fail
-- after entering PIN, or if menu items/orders/chats fail to persist.
--
-- This covers tables that the kitchen write paths touch:
--   kitchens, menu_items, orders, chats, kitchen_chats
--
-- It is safe to re-run multiple times.

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
-- [UPI REMOVED] upiId/bankName/upiDisplayName/qrCodeUrl columns dropped
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

ALTER TABLE chats ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS "senderId" TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS "senderName" TEXT;
-- [UPI REMOVED] isUpiCard/upiCardData/qrCodeUrl columns dropped
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

-- Force PostgREST to refresh table metadata for these tables immediately.
NOTIFY pgrst, 'reload schema';
