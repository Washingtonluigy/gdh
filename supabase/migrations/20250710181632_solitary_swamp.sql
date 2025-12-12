/*
  # Fix get_session_locations function

  1. Function Updates
    - Fix the `get_session_locations` function to properly handle GROUP BY clause
    - Remove unnecessary GROUP BY or include all selected columns
    - Ensure the function returns locations in proper order

  2. Changes
    - Update the function to use simple SELECT without GROUP BY for location retrieval
    - Order by created_at DESC to get most recent locations first
    - Maintain the same return structure for compatibility
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
  location_count integer;
BEGIN
  -- Check if session exists and user has access
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
      'locations', null,
      'count', 0
    );
  END IF;

  -- Get locations for the session
  SELECT 
    json_agg(
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
        'synced', COALESCE(l.synced, true)
      ) ORDER BY l.created_at DESC
    ),
    COUNT(*)
  INTO result_json, location_count
  FROM locations l
  WHERE l.session_id = p_session_id
  ORDER BY l.created_at DESC
  LIMIT p_limit;

  -- Return the result
  RETURN json_build_object(
    'success', true,
    'error', null,
    'locations', COALESCE(result_json, '[]'::json),
    'count', COALESCE(location_count, 0)
  );
END;
$$;