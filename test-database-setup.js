/**
 * Test script to verify database setup for onboarding columns.
 * Run this if onboarding fails with a Supabase/PostgREST schema-cache error
 * such as: PGRST321125152315424215323451152315424434354423153345332334342523154212421144231533144234352315423511334443443412151334323531154415315433112515144423153323154244344445423311423445331443233452231542331125151411434344231115334452154225522324311531343425243322121113254315144513442451153154: could not find the 'handle' column of 'users'.
 */

console.log("=== Database Setup Verification ===\n");

console.log("1. SUPABASE SETUP:");
console.log("Run this SQL in Supabase Dashboard > SQL Editor:");
console.log(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS handle TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "securityPin" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "themePreference" TEXT DEFAULT 'light';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS society TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "flatAddress" TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "myGateId" TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "myGateScreenshot" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "upiDisplayName" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "qrCodeUrl" TEXT;
NOTIFY pgrst, 'reload schema';`);
console.log("\nOr run the checked-in repair script: fix-onboarding-users-schema.sql");

console.log("\n2. TURSO SETUP:");
console.log("The Turso schema already includes the onboarding columns in src/turso.ts");
console.log("Make sure to call initializeDatabase() to create the tables");

console.log("\n3. VERIFICATION:");
console.log("After running the above, test with:");
console.log(`SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('handle', 'profileImageUrl', 'securityPin', 'themePreference', 'flatAddress')
ORDER BY column_name;`);

console.log("\n4. SCHEMA RELOAD:");
console.log("If you still get schema cache errors, reload PostgREST cache with:");
console.log(`NOTIFY pgrst, 'reload schema';`);

console.log("\n=== Common Issues ===");
console.log("- PGRST204 means the API schema cache does not know a column in your payload");
console.log("- Use unquoted handle because the app writes handle");
console.log("- Quote camelCase columns, e.g. \"flatAddress\" and \"profileImageUrl\"");
console.log("- PostgreSQL converts unquoted identifiers to lowercase");
console.log("- PostgREST caches the schema, so changes may require a reload");
console.log("- Check that your Supabase API has proper permissions for the users table");