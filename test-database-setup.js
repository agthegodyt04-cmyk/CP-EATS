/**
 * Test script to verify database setup for flatAddress column
 * Run this to ensure both Supabase and Turso have the flatAddress column
 */

console.log("=== Database Setup Verification ===\n");

console.log("1. SUPABASE SETUP:");
console.log("Run this SQL in Supabase Dashboard > SQL Editor:");
console.log(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "flatAddress" TEXT DEFAULT '';`);

console.log("\n2. TURSO SETUP:");
console.log("The Turso schema already includes flatAddress in src/turso.ts");
console.log("Make sure to call initializeDatabase() to create the tables");

console.log("\n3. VERIFICATION:");
console.log("After running the above, test with:");
console.log(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users';`);

console.log("\n4. SCHEMA RELOAD:");
console.log("If you still get schema cache errors, reload PostgREST cache with:");
console.log(`NOTIFY pgrst, 'reload schema';`);

console.log("\n=== Common Issues ===");
console.log("- Make sure the column name is quoted: \"flatAddress\" not flatAddress");
console.log("- PostgreSQL converts unquoted identifiers to lowercase");
console.log("- PostgREST caches the schema, so changes may require a reload");
console.log("- Check that your Supabase API has proper permissions for the users table");