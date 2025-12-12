/*
  # Adicionar todas as funções RPC necessárias
  
  1. Funções RPC
    - `create_tracking_session` - Criar sessão de rastreamento com verificação de limites
    - `get_session_by_token` - Buscar sessão por token de convite
    - `insert_location` - Inserir localização GPS
    - `get_session_locations` - Buscar localizações de uma sessão
  
  2. Funções auxiliares
    - `generate_unique_tracking_token` - Gerar token único para sessão
    - `handle_new_user` - Trigger para criar perfil automaticamente
  
  3. Segurança
    - Todas as funções usam SECURITY DEFINER
    - Verificações de autenticação e permissões
*/

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

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role, allowed_sessions, is_blocked)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'vendor',
    2,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar a função
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para criar sessão de rastreamento com verificação de limites
CREATE OR REPLACE FUNCTION create_tracking_session(
  p_tracked_user_name TEXT,
  p_tracked_user_phone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile profiles%ROWTYPE;
  active_sessions_count INTEGER;
  new_session tracking_sessions%ROWTYPE;
  invite_token TEXT;
  invite_link TEXT;
BEGIN
  -- Obter perfil do usuário
  SELECT * INTO user_profile 
  FROM profiles 
  WHERE id = auth.uid();
  
  IF user_profile.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado.'
    );
  END IF;

  -- Verificar se usuário está bloqueado
  IF user_profile.is_blocked THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Sua conta está bloqueada. Entre em contato com o suporte.'
    );
  END IF;

  -- Contar sessões ativas/pendentes do usuário
  SELECT COUNT(*) INTO active_sessions_count
  FROM tracking_sessions 
  WHERE admin_id = auth.uid() 
  AND status IN ('active', 'pending');

  -- Verificar limite de sessões
  IF active_sessions_count >= user_profile.allowed_sessions THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Limite de rastreamentos atingido. Você pode criar no máximo ' || user_profile.allowed_sessions || ' rastreamentos.'
    );
  END IF;

  -- Gerar token único
  invite_token := generate_unique_tracking_token();
  
  -- Criar sessão
  INSERT INTO tracking_sessions (
    admin_id,
    tracked_user_name,
    tracked_user_phone,
    invite_token,
    status
  ) VALUES (
    auth.uid(),
    p_tracked_user_name,
    p_tracked_user_phone,
    invite_token,
    'pending'
  ) RETURNING * INTO new_session;

  -- Gerar link de convite (URL genérica)
  invite_link := 'https://vigialink.com?token=' || invite_token;

  RETURN json_build_object(
    'success', true,
    'session_id', new_session.id,
    'invite_token', invite_token,
    'invite_link', invite_link,
    'tracked_user_name', p_tracked_user_name
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
BEGIN
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
      'error', 'Acesso negado',
      'locations', '[]'::json
    );
  END IF;

  -- Buscar localizações
  SELECT json_build_object(
    'success', true,
    'error', null,
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
        'synced', COALESCE(l.synced, true)
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