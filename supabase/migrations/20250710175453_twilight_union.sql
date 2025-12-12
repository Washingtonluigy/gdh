/*
  # Fix get_session_locations function

  1. Database Functions
    - Fix the `get_session_locations` function to resolve GROUP BY clause error
    - Ensure proper column selection without unnecessary grouping
    - Return locations with proper ordering by created_at

  2. Changes
    - Remove problematic GROUP BY clause or include all selected columns
    - Maintain proper function signature and return type
    - Ensure locations are returned in chronological order
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_session_locations(uuid, integer);

-- Create the corrected get_session_locations function
CREATE OR REPLACE FUNCTION get_session_locations(
  p_session_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_json json;
BEGIN
  -- Check if the session exists and user has access
  IF NOT EXISTS (
    SELECT 1 FROM tracking_sessions ts
    WHERE ts.id = p_session_id
    AND (
      ts.admin_id = auth.uid() OR 
      ts.tracked_user_id = auth.uid()
    )
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Session not found or access denied',
      'locations', null
    );
  END IF;

  -- Get locations for the session
  SELECT json_build_object(
    'success', true,
    'error', null,
    'locations', COALESCE(json_agg(
      json_build_object(
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
    ), '[]'::json)
  )
  INTO result_json
  FROM locations l
  WHERE l.session_id = p_session_id
  ORDER BY l.created_at DESC
  LIMIT p_limit;

  -- If no locations found, return empty array
  IF result_json IS NULL THEN
    result_json := json_build_object(
      'success', true,
      'error', null,
      'locations', '[]'::json
    );
  END IF;

  RETURN result_json;
END;
$$;