# Supabase + Turso Database Setup Guide

This guide will help you set up the Supabase/Turso stack for your CP EATS application.

## Overview

You now have two database options configured:

1. **Supabase** - PostgreSQL-based database with real-time capabilities
2. **Turso** - SQLite-based edge database

The system is designed to work with either or both databases simultaneously.

## Setup Steps

### 1. Choose Your Database Configuration

In your application, you can configure which databases to use:

```typescript
// Use only Supabase (default)
const db = new DatabaseService({ useSupabase: true, useTurso: false });

// Use only Turso
const db = new DatabaseService({ useSupabase: false, useTurso: true });

// Use both (Supabase primary, Turso secondary)
const db = new DatabaseService({ useSupabase: true, useTurso: true });
```

### 2. Supabase Setup

#### Create a Supabase Account
1. Go to [https://supabase.com/](https://supabase.com/) and sign up
2. Create a new project
3. Get your project URL and anon key from Project Settings > API

#### Configure Supabase
1. Open `src/supabase.ts`
2. Replace the placeholder values:
```typescript
const supabaseUrl = 'YOUR_SUPABASE_URL'; // e.g., 'https://your-project-ref.supabase.co'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
```

#### Set Up Supabase Database Schema
1. Go to your Supabase dashboard > Table Editor
2. Create the following tables:

**users table:**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**meals table:**
```sql
CREATE TABLE meals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**orders table:**
```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  kitchen_id TEXT NOT NULL,
  status TEXT NOT NULL,
  total REAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (kitchen_id) REFERENCES users(id)
);
```

### 3. Turso Setup

#### Create a Turso Account
1. Go to [https://turso.tech/](https://turso.tech/) and sign up
2. Create a new database
3. Get your database URL and auth token

#### Configure Turso
1. Open `src/turso.ts`
2. Replace the placeholder values:
```typescript
const tursoConfig = {
  url: 'YOUR_TURSO_DB_URL', // e.g., 'libsql://your-db.turso.io'
  authToken: 'YOUR_TURSO_AUTH_TOKEN'
};
```

#### Turso Database Initialization
The Turso database will be automatically initialized when you first use it. The `initializeDatabase()` function creates the necessary tables.

### 4. Netlify Deployment (Optional)

For a complete Supabase/Netlify/Turso stack:

1. **Set up Netlify:**
   - Go to [https://www.netlify.com/](https://www.netlify.com/) and sign up
   - Connect your GitHub repository
   - Set up continuous deployment

2. **Environment Variables:**
   Add these to your Netlify environment variables:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   TURSO_DB_URL=your_turso_db_url
   TURSO_AUTH_TOKEN=your_turso_auth_token
   ```

3. **Netlify Configuration:**
   Create a `netlify.toml` file:
   ```toml
   [build]
   command = "npm run build"
   publish = "dist"

   [[redirects]]
   from = "/*"
   to = "/index.html"
   status = 200
   ```

### 5. Using the Database Service

The main database service is located in `src/database.ts`. Here's how to use it:

```typescript
import { databaseService } from './database';

// Initialize the service
await databaseService.initialize();

// User operations
const user = await databaseService.getUser('user-id');
await databaseService.createUser({
  uid: 'user-id',
  email: 'user@example.com',
  displayName: 'John Doe'
});

// Menu operations
const menuItems = await databaseService.getMenuItems();
await databaseService.createMenuItem({
  id: 'item-id',
  kitchenId: 'kitchen-id',
  name: 'Delicious Meal',
  description: 'A tasty meal',
  price: 12.99,
  isVeg: true,
  isAvailable: true,
  category: 'Main Course'
});

// Order operations
await databaseService.createOrder({
  id: 'order-id',
  customerId: 'customer-id',
  customerName: 'John Doe',
  kitchenId: 'kitchen-id',
  items: [],
  subtotal: 25.98,
  total: 25.98,
  deliveryType: 'delivery',
  status: 'PENDING',
  deliveryPin: '1234',
  createdAt: Date.now()
});
```

### 6. Migration from Firebase

If you're migrating from Firebase to Supabase/Turso:

1. **Authentication:**
   - Supabase has built-in auth that's compatible with Firebase Auth
   - You can import your Firebase users to Supabase

2. **Data Migration:**
   - Export your Firestore data
   - Transform it to match the Supabase/Turso schema
   - Import into your new database

3. **Update Your App:**
   - Replace Firebase imports with the new database service
   - Update any direct Firestore calls to use the new service methods

## Database Comparison

| Feature          | Supabase | Turso |
|------------------|----------|-------|
| Database Type    | PostgreSQL | SQLite |
| Real-time        | ✅ Yes | ❌ No |
| Offline Support  | ✅ Yes | ✅ Yes |
| Scalability      | ✅ High | ✅ Edge |
| SQL Support      | ✅ Full | ✅ Full |
| Cost             | Free tier available | Free tier available |
| Complex Queries  | ✅ Excellent | ✅ Good |
| JSON Support     | ✅ Excellent | ✅ Good |

## Recommended Configuration

For most use cases, we recommend:

1. **Use Supabase as primary database** - for real-time features, complex queries, and authentication
2. **Use Turso for edge caching** - for fast reads at the edge
3. **Keep Firebase Auth** - if you want to maintain your existing authentication system

## Troubleshooting

**Supabase Issues:**
- Check your API keys are correct
- Verify CORS settings in Supabase dashboard
- Check network tab for API errors

**Turso Issues:**
- Verify your database URL and auth token
- Check that tables were created properly
- Test connection with a simple query

**General Issues:**
- Make sure you've installed all dependencies: `npm install @supabase/supabase-js @libsql/client`
- Check TypeScript compilation errors
- Verify environment variables are set correctly

## Next Steps

1. Set up your Supabase and/or Turso accounts
2. Configure the credentials in the respective files
3. Test the database operations
4. Gradually migrate your application to use the new database service
5. Deploy to Netlify when ready

The stack is now ready for you to configure and use! Let me know if you need any specific help with the setup process.