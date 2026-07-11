-- Fix kitchen_chats participants column from JSONB to TEXT[]
-- This fixes the 400 error when using array-contains operator
-- Run this in Supabase Dashboard > SQL Editor

-- Step 1: Drop the existing JSONB column and recreate as TEXT[]
ALTER TABLE IF EXISTS kitchen_chats 
  DROP COLUMN IF EXISTS participants,
  ADD COLUMN participants TEXT[] DEFAULT '{}';

-- Step 2: Update the index to work with the new array type
DROP INDEX IF EXISTS idx_kitchen_chats_conversation;
CREATE INDEX IF NOT EXISTS idx_kitchen_chats_conversation 
  ON kitchen_chats("conversationId");

-- Step 3: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verification query (optional - run after migration)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'kitchen_chats' 
-- AND column_name = 'participants';