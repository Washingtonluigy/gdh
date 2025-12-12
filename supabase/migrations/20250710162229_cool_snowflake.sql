/*
  # Sistema Completo de Rastreamento GPS

  1. Estrutura Completa
    - Sessões de rastreamento
    - Localizações GPS em tempo real
    - Sistema de convites simplificado
    - Usuários automáticos para rastreamento

  2. Funcionalidades
    - Criação automática de usuários rastreados
    - Sincronização offline/online
    - Rastreamento em tempo real
    - Painel administrativo completo

  3. Segurança
    - RLS habilitado
    - Políticas específicas para cada tipo de usuário
*/

-- Limpar dados existentes para recomeçar
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS tracking_invites CASCADE;
DROP TABLE IF EXISTS tracking_sessions CASCADE;

-- Recriar tabela de sessões de rastreamento
CREATE TABLE tracking_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id uuid REFERENCES profiles(id) NOT NULL,
  tracked_user_name text NOT NULL,
  tracked_user_phone text,
  tracked_user_id uuid REFERENCES profiles(id),
  invite_token text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  last_location_update timestamptz
);

-- Recriar tabela de localizações
CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES tracking_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id),
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  accuracy decimal(8, 2) DEFAULT 0,
  altitude decimal(8, 2),
  heading decimal(5, 2),
  speed decimal(8, 2),
  address text,
  created_at timestamptz DEFAULT now(),
  synced boolean DEFAULT true
);

-- Habilitar RLS
ALTER TABLE tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Políticas para tracking_sessions
CREATE POLICY "Admins can manage their sessions"
  ON tracking_sessions FOR ALL
  TO authenticated
  USING (admin_id = auth.uid());

CREATE POLICY "Tracked users can read their sessions"
  ON tracking_sessions FOR SELECT
  TO authenticated
  USING (tracked_user_id = auth.uid());

CREATE POLICY "Tracked users can update their session status"
  ON tracking_sessions FOR UPDATE
  TO authenticated
  USING (tracked_user_id = auth.uid())
  WITH CHECK (tracked_user_id = auth.uid());

-- Políticas para locations
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

-- Índices para performance
CREATE INDEX idx_tracking_sessions_admin_id ON tracking_sessions(admin_id);
CREATE INDEX idx_tracking_sessions_status ON tracking_sessions(status);
CREATE INDEX idx_tracking_sessions_invite_token ON tracking_sessions(invite_token);
CREATE INDEX idx_locations_session_id ON locations(session_id);
CREATE INDEX idx_locations_created_at ON locations(created_at DESC);
CREATE INDEX idx_locations_session_created ON locations(session_id, created_at DESC);

-- Função para gerar token único
CREATE OR REPLACE FUNCTION generate_unique_tracking_token()
RETURNS text AS $$
DECLARE
  new_token text;
BEGIN
  LOOP
    new_token := 'track-' || encode(gen_random_bytes(12), 'hex');
    
    EXIT WHEN NOT EXISTS(
      SELECT 1 FROM tracking_sessions WHERE invite_token = new_token
    );
  END LOOP;
  
  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Função para criar sessão de rastreamento
CREATE OR REPLACE FUNCTION create_tracking_session(
  p_tracked_user_name text,
  p_tracked_user_phone text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_session_id uuid;
  v_invite_token text;
  v_admin_id uuid;
  v_result json;
BEGIN
  -- Verificar autenticação
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('error', 'Usuário não autenticado', 'success', false);
  END IF;
  
  -- Validar entrada
  IF p_tracked_user_name IS NULL OR trim(p_tracked_user_name) = '' THEN
    RETURN json_build_object('error', 'Nome é obrigatório', 'success', false);
  END IF;
  
  -- Gerar token único
  v_invite_token := generate_unique_tracking_token();
  
  -- Criar sessão
  INSERT INTO tracking_sessions (
    admin_id,
    tracked_user_name,
    tracked_user_phone,
    invite_token,
    status,
    expires_at
  )
  VALUES (
    v_admin_id,
    trim(p_tracked_user_name),
    COALESCE(trim(p_tracked_user_phone), ''),
    v_invite_token,
    'pending',
    now() + interval '30 days'
  )
  RETURNING id INTO v_session_id;
  
  -- Retornar resultado
  SELECT json_build_object(
    'success', true,
    'id', id,
    'admin_id', admin_id,
    'tracked_user_name', tracked_user_name,
    'tracked_user_phone', tracked_user_phone,
    'invite_token', invite_token,
    'invite_link', 'https://localhost:5173?token=' || invite_token,
    'status', status,
    'created_at', created_at,
    'expires_at', expires_at
  ) INTO v_result
  FROM tracking_sessions
  WHERE id = v_session_id;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', 'Erro ao criar sessão: ' || SQLERRM,
      'success', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para aceitar rastreamento (cria usuário automático)
CREATE OR REPLACE FUNCTION accept_tracking_invite(p_token text)
RETURNS json AS $$
DECLARE
  v_session_id uuid;
  v_admin_id uuid;
  v_tracked_user_name text;
  v_new_user_id uuid;
  v_new_email text;
  v_new_password text;
  v_result json;
BEGIN
  -- Buscar sessão válida
  SELECT id, admin_id, tracked_user_name
  INTO v_session_id, v_admin_id, v_tracked_user_name
  FROM tracking_sessions
  WHERE invite_token = p_token
    AND status = 'pending'
    AND expires_at > now();
  
  IF v_session_id IS NULL THEN
    RETURN json_build_object('error', 'Convite inválido ou expirado', 'success', false);
  END IF;
  
  -- Gerar credenciais para usuário automático
  v_new_user_id := uuid_generate_v4();
  v_new_email := 'tracked-' || encode(gen_random_bytes(8), 'hex') || '@rastreiafamilia.auto';
  v_new_password := encode(gen_random_bytes(16), 'hex');
  
  -- Criar usuário automático no auth.users
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data
  )
  VALUES (
    v_new_user_id,
    v_new_email,
    crypt(v_new_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    json_build_object(
      'full_name', v_tracked_user_name,
      'auto_created', true,
      'tracking_session', v_session_id
    )
  );
  
  -- Criar perfil
  INSERT INTO profiles (id, full_name, role)
  VALUES (v_new_user_id, v_tracked_user_name, 'vendor');
  
  -- Atualizar sessão
  UPDATE tracking_sessions
  SET 
    status = 'active',
    tracked_user_id = v_new_user_id,
    accepted_at = now()
  WHERE id = v_session_id;
  
  RETURN json_build_object(
    'success', true,
    'session_id', v_session_id,
    'user_id', v_new_user_id,
    'email', v_new_email,
    'password', v_new_password,
    'message', 'Rastreamento ativado com sucesso'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', 'Erro ao aceitar convite: ' || SQLERRM,
      'success', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para inserir localização
CREATE OR REPLACE FUNCTION insert_location(
  p_session_id uuid,
  p_latitude decimal,
  p_longitude decimal,
  p_accuracy decimal DEFAULT NULL,
  p_altitude decimal DEFAULT NULL,
  p_heading decimal DEFAULT NULL,
  p_speed decimal DEFAULT NULL,
  p_address text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_location_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Usuário não autenticado', 'success', false);
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
    address,
    created_at
  )
  VALUES (
    p_session_id,
    v_user_id,
    p_latitude,
    p_longitude,
    p_accuracy,
    p_altitude,
    p_heading,
    p_speed,
    p_address,
    now()
  )
  RETURNING id INTO v_location_id;
  
  -- Atualizar timestamp da sessão
  UPDATE tracking_sessions
  SET last_location_update = now()
  WHERE id = p_session_id;
  
  RETURN json_build_object(
    'success', true,
    'location_id', v_location_id,
    'message', 'Localização salva com sucesso'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', 'Erro ao salvar localização: ' || SQLERRM,
      'success', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar localizações de uma sessão
CREATE OR REPLACE FUNCTION get_session_locations(
  p_session_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS json AS $$
DECLARE
  v_result json;
  v_is_admin boolean := false;
BEGIN
  -- Verificar se é admin da sessão
  SELECT EXISTS(
    SELECT 1 FROM tracking_sessions 
    WHERE id = p_session_id AND admin_id = auth.uid()
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object('error', 'Sem permissão', 'success', false);
  END IF;
  
  -- Buscar localizações
  SELECT json_build_object(
    'success', true,
    'locations', json_agg(
      json_build_object(
        'id', id,
        'latitude', latitude,
        'longitude', longitude,
        'accuracy', accuracy,
        'altitude', altitude,
        'heading', heading,
        'speed', speed,
        'address', address,
        'created_at', created_at
      ) ORDER BY created_at DESC
    )
  ) INTO v_result
  FROM locations
  WHERE session_id = p_session_id
  ORDER BY created_at DESC
  LIMIT p_limit;
  
  RETURN COALESCE(v_result, json_build_object('success', true, 'locations', '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar sessão por token
CREATE OR REPLACE FUNCTION get_session_by_token(p_token text)
RETURNS json AS $$
DECLARE
  v_result json;
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
  ) INTO v_result
  FROM tracking_sessions ts
  LEFT JOIN profiles p ON p.id = ts.admin_id
  WHERE ts.invite_token = p_token
    AND ts.status = 'pending'
    AND ts.expires_at > now();
  
  IF v_result IS NULL THEN
    RETURN json_build_object('error', 'Sessão não encontrada ou expirada', 'success', false);
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tracking_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE locations;

-- Trigger para notificações
CREATE OR REPLACE FUNCTION notify_location_update()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'location_update',
    json_build_object(
      'session_id', NEW.session_id,
      'latitude', NEW.latitude,
      'longitude', NEW.longitude,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER location_update_notify
  AFTER INSERT ON locations
  FOR EACH ROW
  EXECUTE FUNCTION notify_location_update();