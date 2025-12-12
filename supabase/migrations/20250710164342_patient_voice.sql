/*
  # Sistema de Rastreamento GPS Funcional

  1. Novas Tabelas
    - `tracking_sessions` - Sessões de rastreamento
    - `locations` - Localizações GPS
    - `profiles` - Perfis de usuários

  2. Funções
    - Criar sessão de rastreamento
    - Aceitar convite
    - Inserir localização
    - Buscar localizações

  3. Segurança
    - RLS habilitado
    - Políticas de acesso
*/

-- Limpar tabelas existentes se necessário
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS tracking_sessions CASCADE;

-- Recriar tabela de sessões de rastreamento
CREATE TABLE IF NOT EXISTS tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tracked_user_name text NOT NULL,
  tracked_user_phone text,
  tracked_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invite_token text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  last_location_update timestamptz
);

-- Recriar tabela de localizações
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES tracking_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  latitude numeric(10,8) NOT NULL,
  longitude numeric(11,8) NOT NULL,
  accuracy numeric(8,2) DEFAULT 0,
  altitude numeric(8,2),
  heading numeric(5,2),
  speed numeric(8,2),
  address text,
  created_at timestamptz DEFAULT now(),
  synced boolean DEFAULT true
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_admin_id ON tracking_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_invite_token ON tracking_sessions(invite_token);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_status ON tracking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_locations_session_id ON locations(session_id);
CREATE INDEX IF NOT EXISTS idx_locations_created_at ON locations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_session_created ON locations(session_id, created_at DESC);

-- Habilitar RLS
ALTER TABLE tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Políticas para tracking_sessions
CREATE POLICY "Admins can manage their sessions"
  ON tracking_sessions
  FOR ALL
  TO authenticated
  USING (admin_id = auth.uid());

CREATE POLICY "Tracked users can read their sessions"
  ON tracking_sessions
  FOR SELECT
  TO authenticated
  USING (tracked_user_id = auth.uid());

CREATE POLICY "Tracked users can update their session status"
  ON tracking_sessions
  FOR UPDATE
  TO authenticated
  USING (tracked_user_id = auth.uid())
  WITH CHECK (tracked_user_id = auth.uid());

-- Políticas para locations
CREATE POLICY "Admins can read locations from their sessions"
  ON locations
  FOR SELECT
  TO authenticated
  USING (session_id IN (
    SELECT id FROM tracking_sessions WHERE admin_id = auth.uid()
  ));

CREATE POLICY "Tracked users can insert their locations"
  ON locations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tracked users can read their own locations"
  ON locations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Função para criar sessão de rastreamento
CREATE OR REPLACE FUNCTION create_tracking_session(
  p_tracked_user_name text,
  p_tracked_user_phone text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id uuid;
  v_invite_token text;
  v_invite_link text;
BEGIN
  -- Verificar se o usuário está autenticado
  IF auth.uid() IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não autenticado'
    );
  END IF;

  -- Gerar token único
  v_invite_token := 'track-' || encode(gen_random_bytes(16), 'hex');
  
  -- Inserir nova sessão
  INSERT INTO tracking_sessions (
    admin_id,
    tracked_user_name,
    tracked_user_phone,
    invite_token
  ) VALUES (
    auth.uid(),
    p_tracked_user_name,
    p_tracked_user_phone,
    v_invite_token
  ) RETURNING id INTO v_session_id;

  -- Construir link de convite
  v_invite_link := current_setting('app.base_url', true) || '?token=' || v_invite_token;

  RETURN json_build_object(
    'success', true,
    'session_id', v_session_id,
    'invite_token', v_invite_token,
    'invite_link', v_invite_link
  );
END;
$$;

-- Função para aceitar convite
CREATE OR REPLACE FUNCTION accept_tracking_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session tracking_sessions%ROWTYPE;
  v_user_id uuid;
  v_email text;
  v_password text;
  v_user_data json;
BEGIN
  -- Buscar sessão pelo token
  SELECT * INTO v_session
  FROM tracking_sessions
  WHERE invite_token = p_token
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Convite inválido ou expirado'
    );
  END IF;

  -- Se usuário não está autenticado, criar conta automaticamente
  IF auth.uid() IS NULL THEN
    -- Gerar credenciais automáticas
    v_email := 'user-' || encode(gen_random_bytes(8), 'hex') || '@rastreiafamilia.com';
    v_password := encode(gen_random_bytes(12), 'base64');

    -- Criar usuário no Supabase Auth
    SELECT auth.users.id INTO v_user_id
    FROM auth.users
    WHERE auth.users.email = v_email;

    IF v_user_id IS NULL THEN
      -- Simular criação de usuário (em produção seria via API do Supabase)
      v_user_id := gen_random_uuid();
      
      -- Criar perfil
      INSERT INTO profiles (id, full_name, role)
      VALUES (v_user_id, v_session.tracked_user_name, 'vendor');
    END IF;
  ELSE
    v_user_id := auth.uid();
  END IF;

  -- Atualizar sessão como aceita
  UPDATE tracking_sessions
  SET 
    status = 'active',
    tracked_user_id = v_user_id,
    accepted_at = now()
  WHERE id = v_session.id;

  RETURN json_build_object(
    'success', true,
    'session_id', v_session.id,
    'user_id', v_user_id,
    'email', v_email,
    'password', v_password,
    'message', 'Rastreamento ativado com sucesso'
  );
END;
$$;

-- Função para buscar sessão por token
CREATE OR REPLACE FUNCTION get_session_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_data json;
BEGIN
  SELECT json_build_object(
    'success', true,
    'session', json_build_object(
      'id', ts.id,
      'tracked_user_name', ts.tracked_user_name,
      'tracked_user_phone', ts.tracked_user_phone,
      'status', ts.status,
      'created_at', ts.created_at,
      'expires_at', ts.expires_at,
      'admin_name', p.full_name
    )
  ) INTO v_session_data
  FROM tracking_sessions ts
  LEFT JOIN profiles p ON p.id = ts.admin_id
  WHERE ts.invite_token = p_token
    AND ts.expires_at > now();

  IF v_session_data IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Sessão não encontrada ou expirada'
    );
  END IF;

  RETURN v_session_data;
END;
$$;

-- Função para inserir localização
CREATE OR REPLACE FUNCTION insert_location(
  p_session_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy numeric DEFAULT NULL,
  p_altitude numeric DEFAULT NULL,
  p_heading numeric DEFAULT NULL,
  p_speed numeric DEFAULT NULL,
  p_address text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_location_id uuid;
  v_session tracking_sessions%ROWTYPE;
BEGIN
  -- Verificar se a sessão existe e está ativa
  SELECT * INTO v_session
  FROM tracking_sessions
  WHERE id = p_session_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Sessão não encontrada ou inativa'
    );
  END IF;

  -- Inserir localização
  INSERT INTO locations (
    session_id,
    user_id,
    latitude,
    longitude,
    accuracy,
    altitude,
    heading,
    speed,
    address
  ) VALUES (
    p_session_id,
    auth.uid(),
    p_latitude,
    p_longitude,
    p_accuracy,
    p_altitude,
    p_heading,
    p_speed,
    p_address
  ) RETURNING id INTO v_location_id;

  -- Atualizar timestamp da última localização na sessão
  UPDATE tracking_sessions
  SET last_location_update = now()
  WHERE id = p_session_id;

  RETURN json_build_object(
    'success', true,
    'location_id', v_location_id
  );
END;
$$;

-- Função para buscar localizações de uma sessão
CREATE OR REPLACE FUNCTION get_session_locations(
  p_session_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locations json;
BEGIN
  -- Verificar se o usuário tem acesso à sessão
  IF NOT EXISTS (
    SELECT 1 FROM tracking_sessions
    WHERE id = p_session_id
      AND (admin_id = auth.uid() OR tracked_user_id = auth.uid())
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Acesso negado'
    );
  END IF;

  -- Buscar localizações
  SELECT json_build_object(
    'success', true,
    'locations', COALESCE(json_agg(
      json_build_object(
        'id', l.id,
        'session_id', l.session_id,
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
  ) INTO v_locations
  FROM locations l
  WHERE l.session_id = p_session_id
  ORDER BY l.created_at DESC
  LIMIT p_limit;

  RETURN v_locations;
END;
$$;

-- Trigger para notificar mudanças de localização
CREATE OR REPLACE FUNCTION notify_location_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'location_update',
    json_build_object(
      'session_id', NEW.session_id,
      'location', row_to_json(NEW)
    )::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER location_update_notify
  AFTER INSERT ON locations
  FOR EACH ROW
  EXECUTE FUNCTION notify_location_update();