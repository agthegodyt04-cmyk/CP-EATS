-- CP EATS onboarding repair migration
--
-- Run this in Supabase Dashboard > SQL Editor if onboarding fails with:
-- PGRST204: could not find the 'handle' column of 'users' in the schema cache
--
-- Why this happens:
-- The onboarding flow saves kitchen profile fields (`handle`, `profileImageUrl`,
-- `securityPin`) into public.users. If the live Supabase users table was created
-- from an older schema, PostgREST rejects those fields until the columns exist
-- and its schema cache is reloaded.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS handle TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "securityPin" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "themePreference" TEXT DEFAULT 'light';

-- These are also required by the current onboarding/profile payload and are
-- safe to run repeatedly on existing Supabase projects.
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

-- Force Supabase/PostgREST to refresh its cached table columns immediately.
NOTIFY pgrst, 'reload schema';

-- Verify the columns are visible in Postgres after running this migration.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN (
    'handle',
    'profileImageUrl',
    'securityPin',
    'themePreference',
    'role',
    'phone',
    'society',
    'flatAddress',
    'myGateId',
    'myGateScreenshot',
    'status',
    'upiId',
    'bankName',
    'upiDisplayName',
    'qrCodeUrl'
  )
ORDER BY column_name;