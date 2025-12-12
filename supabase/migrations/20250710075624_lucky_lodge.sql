/*
  # Sistema de Rastreamento Familiar - Schema Completo

  1. New Tables
    - `profiles` - Perfis de usuários (admin/tracked)
    - `tracking_sessions` - Sessões de rastreamento
    - `locations` - Localizações GPS em tempo real
    - `tracking_invites` - Convites de rastreamento

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users
    - Admin can manage their sessions
    - Tracked users can only update their locations

  3. Real-time Features
    - Location updates via subscription
    - Session status changes
    - Invite acceptance notifications
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'tracked')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tracking sessions table
CREATE TABLE IF NOT EXISTS tracking_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id uuid REFERENCES profiles(id) NOT NULL,
  tracked_user_name text NOT NULL,
  tracked_user_phone text,
  tracked_user_id uuid REFERENCES profiles(id),
  invite_token text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

-- Locations table for real GPS tracking
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES tracking_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id),
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  accuracy decimal(8, 2),
  altitude decimal(8, 2),
  heading decimal(5, 2),
  speed decimal(8, 2),
  address text,
  created_at timestamptz DEFAULT now()
);

-- Tracking invites for managing invite links
CREATE TABLE IF NOT EXISTS tracking_invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES tracking_sessions(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_invites ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Tracking sessions policies
CREATE POLICY "Admins can manage their sessions"
  ON tracking_sessions FOR ALL
  TO authenticated
  USING (admin_id = auth.uid());

CREATE POLICY "Tracked users can read sessions they're part of"
  ON tracking_sessions FOR SELECT
  TO authenticated
  USING (tracked_user_id = auth.uid());

CREATE POLICY "Tracked users can update session status"
  ON tracking_sessions FOR UPDATE
  TO authenticated
  USING (tracked_user_id = auth.uid())
  WITH CHECK (tracked_user_id = auth.uid());

-- Locations policies
CREATE POLICY "Admins can read locations from their sessions"
  ON locations FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM tracking_sessions WHERE admin_id = auth.uid()
    )
  );

CREATE POLICY "Tracked users can insert their locations"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tracked users can read their own locations"
  ON locations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Tracking invites policies
CREATE POLICY "Admins can manage their invites"
  ON tracking_invites FOR ALL
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM tracking_sessions WHERE admin_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read pending invites by token"
  ON tracking_invites FOR SELECT
  TO authenticated
  USING (status = 'pending');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_admin_id ON tracking_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_status ON tracking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_locations_session_id ON locations(session_id);
CREATE INDEX IF NOT EXISTS idx_locations_created_at ON locations(created_at);
CREATE INDEX IF NOT EXISTS idx_tracking_invites_token ON tracking_invites(token);
CREATE INDEX IF NOT EXISTS idx_tracking_invites_session_id ON tracking_invites(session_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate invite tokens
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS text AS $$
BEGIN
  RETURN 'tracking-' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to create tracking session with invite
CREATE OR REPLACE FUNCTION create_tracking_session(
  p_tracked_user_name text,
  p_tracked_user_phone text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_session_id uuid;
  v_invite_token text;
  v_result json;
BEGIN
  -- Generate invite token
  v_invite_token := generate_invite_token();
  
  -- Create tracking session
  INSERT INTO tracking_sessions (admin_id, tracked_user_name, tracked_user_phone, invite_token)
  VALUES (auth.uid(), p_tracked_user_name, p_tracked_user_phone, v_invite_token)
  RETURNING id INTO v_session_id;
  
  -- Create invite record
  INSERT INTO tracking_invites (session_id, token, phone)
  VALUES (v_session_id, v_invite_token, p_tracked_user_phone);
  
  -- Return session data
  SELECT json_build_object(
    'id', id,
    'tracked_user_name', tracked_user_name,
    'tracked_user_phone', tracked_user_phone,
    'invite_token', invite_token,
    'invite_link', 'https://' || current_setting('app.base_url', true) || '?token=' || invite_token,
    'status', status,
    'created_at', created_at
  ) INTO v_result
  FROM tracking_sessions
  WHERE id = v_session_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept tracking invite
CREATE OR REPLACE FUNCTION accept_tracking_invite(p_token text)
RETURNS json AS $$
DECLARE
  v_session_id uuid;
  v_invite_id uuid;
  v_result json;
BEGIN
  -- Find and validate invite
  SELECT ti.id, ti.session_id INTO v_invite_id, v_session_id
  FROM tracking_invites ti
  WHERE ti.token = p_token 
    AND ti.status = 'pending' 
    AND ti.expires_at > now();
  
  IF v_session_id IS NULL THEN
    RETURN json_build_object('error', 'Invalid or expired invite token');
  END IF;
  
  -- Update invite status
  UPDATE tracking_invites 
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invite_id;
  
  -- Update session status and link tracked user
  UPDATE tracking_sessions 
  SET status = 'active', 
      accepted_at = now(),
      tracked_user_id = auth.uid()
  WHERE id = v_session_id;
  
  -- Return success
  SELECT json_build_object(
    'success', true,
    'session_id', v_session_id,
    'message', 'Tracking accepted successfully'
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;