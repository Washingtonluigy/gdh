/*
  # Add updated_at column to profiles table

  1. Changes
    - Add `updated_at` column to `profiles` table with default value
    - This resolves the trigger error that expects this field to exist

  The trigger `update_profiles_updated_at` already exists and expects this column,
  but the column was missing from the table schema.
*/

-- Add the missing updated_at column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing records to have the updated_at value
UPDATE profiles 
SET updated_at = created_at 
WHERE updated_at IS NULL;