import { createClient } from '@libsql/client';

const tursoConfig = {
  url: import.meta.env.VITE_TURSO_DB_URL || import.meta.env.VITE_TURSO_URL || 'libsql://cp-eats-agthegodyt.aws-us-west-2.turso.io',
  authToken: import.meta.env.VITE_TURSO_AUTH_TOKEN || ''
};

const turso = createClient(tursoConfig);

async function initializeDatabase() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'customer',
      phone TEXT DEFAULT '',
      society TEXT DEFAULT '',
      flatAddress TEXT DEFAULT '',
      myGateId TEXT DEFAULT '',
      myGateScreenshot TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      upiId TEXT DEFAULT '',
      bankName TEXT DEFAULT '',
      upiDisplayName TEXT DEFAULT '',
      qrCodeUrl TEXT DEFAULT '',
      securityPin TEXT DEFAULT '',
      handle TEXT DEFAULT '',
      profileImageUrl TEXT DEFAULT '',
      themePreference TEXT DEFAULT 'light',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS kitchens (
      id TEXT PRIMARY KEY,
      kitchenName TEXT NOT NULL,
      handle TEXT DEFAULT '',
      profileImageUrl TEXT DEFAULT '',
      ringtoneMode TEXT DEFAULT 'builtin',
      ringtoneChoice TEXT DEFAULT 'Piping Hot',
      ringtoneUrl TEXT DEFAULT '',
      vegType TEXT DEFAULT 'veg',
      mov REAL DEFAULT 100,
      isOnline INTEGER DEFAULT 1,
      restingUntil INTEGER,
      operatingMode TEXT DEFAULT 'online',
      upiId TEXT DEFAULT '',
      bankName TEXT DEFAULT '',
      upiDisplayName TEXT DEFAULT '',
      qrCodeUrl TEXT DEFAULT '',
      cuisineType TEXT DEFAULT '',
      society TEXT DEFAULT '',
      flatAddress TEXT DEFAULT '',
      deliveryLocations TEXT DEFAULT '[]',
      securityPin TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      kitchenId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      isVeg INTEGER DEFAULT 1,
      isGlutenFree INTEGER DEFAULT 0,
      isNutFree INTEGER DEFAULT 0,
      isAvailable INTEGER DEFAULT 1,
      category TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      imageUrl TEXT DEFAULT '',
      addOnGroups TEXT DEFAULT '[]'
    )`,
    `CREATE TABLE IF NOT EXISTS feed_posts (
      id TEXT PRIMARY KEY,
      kitchenId TEXT NOT NULL,
      kitchenName TEXT NOT NULL,
      description TEXT DEFAULT '',
      imageUrl TEXT DEFAULT '',
      likes TEXT DEFAULT '[]',
      taggedItemId TEXT,
      taggedItemName TEXT,
      taggedItemPrice REAL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      hasAiSparkle INTEGER DEFAULT 0,
      aiSparkleImposed INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customerId TEXT NOT NULL,
      customerName TEXT DEFAULT '',
      customerPhone TEXT DEFAULT '',
      customerAddress TEXT DEFAULT '',
      kitchenId TEXT NOT NULL,
      kitchenName TEXT DEFAULT '',
      items TEXT DEFAULT '[]',
      subtotal REAL DEFAULT 0,
      total REAL DEFAULT 0,
      deliveryType TEXT DEFAULT 'delivery',
      status TEXT DEFAULT 'PENDING',
      deliveryPin TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      scheduledTime TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      menuItemId TEXT NOT NULL,
      kitchenId TEXT NOT NULL,
      name TEXT DEFAULT '',
      price REAL DEFAULT 0,
      imageUrl TEXT DEFAULT '',
      isVeg INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      followerId TEXT NOT NULL,
      kitchenId TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      postId TEXT NOT NULL,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      userRole TEXT NOT NULL,
      text TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      kitchenId TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
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
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT DEFAULT '',
      text TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      senderName TEXT DEFAULT '',
      text TEXT DEFAULT '',
      isUpiCard INTEGER DEFAULT 0,
      upiCardData TEXT DEFAULT 'null',
      qrCodeUrl TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS kitchen_chats (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      participants TEXT DEFAULT '[]',
      senderId TEXT NOT NULL,
      senderName TEXT DEFAULT '',
      senderHandle TEXT DEFAULT '',
      recipientId TEXT NOT NULL,
      recipientName TEXT DEFAULT '',
      recipientHandle TEXT DEFAULT '',
      text TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS address_registry (
      id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      email TEXT DEFAULT '',
      role TEXT DEFAULT '',
      flatAddress TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS handle_registry (
      id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      email TEXT DEFAULT '',
      handle TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const statement of statements) {
    await turso.execute(statement);
  }

  console.log('Turso database initialized successfully');
}

export async function getUserById(userId: string) {
  const result = await turso.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [userId]
  });
  return result.rows[0] as any;
}

export async function createUser(user: { id: string; email: string; name?: string }) {
  await turso.execute({
    sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
    args: [user.id, user.email, user.name || null]
  });
}

export async function getAllMeals() {
  const result = await turso.execute('SELECT * FROM meals ORDER BY created_at DESC');
  return result.rows as any[];
}

export async function createMeal(meal: { id: string; user_id: string; name: string; description?: string; price: number }) {
  await turso.execute({
    sql: 'INSERT INTO meals (id, user_id, name, description, price) VALUES (?, ?, ?, ?, ?)',
    args: [meal.id, meal.user_id, meal.name, meal.description || null, meal.price]
  });
}

export { turso, initializeDatabase };
  