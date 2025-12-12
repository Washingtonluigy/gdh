/*
  # Fix get_session_locations function GROUP BY error

  1. Function Updates
    - Fix the `get_session_locations` function to properly handle the SELECT statement
    - Remove problematic GROUP BY clause that conflicts with l.created_at
    - Ensure the function returns individual location records as intended

  2. Changes Made
    - Updated the function to return all location fields without aggregation
    - Maintained proper ordering by created_at descending
    - Fixed the column selection to avoid GROUP BY conflicts
*/

-- Drop the existing function first
DROP FUNCTION IF EXISTS get_session_locations(uuid, integer);

-- Recreate the function with proper SQL structure
CREATE OR REPLACE FUNCTION get_session_locations(
  p_session_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  locations jsonb,
  total_count integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count integer;
  v_locations jsonb;
BEGIN
  -- Get total count
  SELECT COUNT(*)
  INTO v_total_count
  FROM locations l
  WHERE l.session_id = p_session_id;

  -- Get locations as JSON array
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'session_id', l.session_id,
        'user_id', l.user_id,
        'latitude', l.latitude,
        'longitude', l.longitude,
        'accuracy', l.accuracy,
        'altitude', l.altitude,
        'heading', l.heading,
        'speed', l.speed,
        'address', l.address,
        'created_at', l.created_at,
        'synced', l.synced
      ) ORDER BY l.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_locations
  FROM (
    SELECT *
    FROM locations l
    WHERE l.session_id = p_session_id
    ORDER BY l.created_at DESC
    LIMIT p_limit
  ) l;

  -- Return the results
  RETURN QUERY SELECT v_locations, v_total_count;
END;
$$;