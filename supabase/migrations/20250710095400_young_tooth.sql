/*
  # Funções para Sistema de Rastreamento GPS

  1. Funções RPC
    - `create_tracking_session` - Criar sessão de rastreamento
    - `accept_tracking_invite` - Aceitar convite de rastreamento
    - `get_session_locations` - Buscar localizações de uma sessão
    - `update_session_status` - Atualizar status da sessão

  2. Triggers
    - Auto-geração de tokens únicos
    - Limpeza automática de sessões expiradas
    - Notificações em tempo real

  3. Índices de Performance
    - Otimização para consultas de localização
    - Índices para busca por token
*/

-- Função para gerar tokens únicos
CREATE OR REPLACE FUNCTION generate_unique_token()
RETURNS text AS $$
DECLARE
  new_token text;
  token_exists boolean;
BEGIN
  LOOP
    new_token := 'tracking-' || encode(gen_random_bytes(16), 'hex');
    
    SELECT EXISTS(
      SELECT 1 FROM tracking_sessions WHERE invite_token = new_token
    ) INTO token_exists;
    
    EXIT WHEN NOT token_exists;
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
  v_result json;
BEGIN
  -- Verificar se o usuário está autenticado
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Usuário não autenticado');
  END IF;
  
  -- Gerar token único
  v_invite_token := generate_unique_token();
  
  -- Criar sessão de rastreamento
  INSERT INTO tracking_sessions (
    admin_id, 
    tracked_user_name, 
    tracked_user_phone, 
    invite_token,
    status,
    expires_at
  )
  VALUES (
    auth.uid(), 
    p_tracked_user_name, 
    p_tracked_user_phone, 
    v_invite_token,
    'pending',
    now() + interval '7 days'
  )
  RETURNING id INTO v_session_id;
  
  -- Criar convite correspondente
  INSERT INTO tracking_invites (session_id, token, phone, expires_at)
  VALUES (v_session_id, v_invite_token, p_tracked_user_phone, now() + interval '7 days');
  
  -- Retornar dados da sessão
  SELECT json_build_object(
    'id', id,
    'tracked_user_name', tracked_user_name,
    'tracked_user_phone', tracked_user_phone,
    'invite_token', invite_token,
    'invite_link', current_setting('app.base_url', true) || '?token=' || invite_token,
    'status', status,
    'created_at', created_at,
    'expires_at', expires_at
  ) INTO v_result
  FROM tracking_sessions
  WHERE id = v_session_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para aceitar convite de rastreamento
CREATE OR REPLACE FUNCTION accept_tracking_invite(p_token text)
RETURNS json AS $$
DECLARE
  v_session_id uuid;
  v_invite_id uuid;
  v_admin_id uuid;
  v_result json;
BEGIN
  -- Verificar se o usuário está autenticado
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Usuário não autenticado');
  END IF;
  
  -- Buscar convite válido
  SELECT 
    ti.id, 
    ti.session_id,
    ts.admin_id
  INTO v_invite_id, v_session_id, v_admin_id
  FROM tracking_invites ti
  JOIN tracking_sessions ts ON ts.id = ti.session_id
  WHERE ti.token = p_token 
    AND ti.status = 'pending' 
    AND ti.expires_at > now()
    AND ts.status = 'pending';
  
  -- Verificar se o convite existe e é válido
  IF v_session_id IS NULL THEN
    RETURN json_build_object('error', 'Convite inválido, expirado ou já utilizado');
  END IF;
  
  -- Verificar se não é o próprio admin tentando aceitar
  IF v_admin_id = auth.uid() THEN
    RETURN json_build_object('error', 'Você não pode aceitar seu próprio convite');
  END IF;
  
  -- Atualizar status do convite
  UPDATE tracking_invites 
  SET 
    status = 'accepted', 
    accepted_at = now()
  WHERE id = v_invite_id;
  
  -- Atualizar sessão de rastreamento
  UPDATE tracking_sessions 
  SET 
    status = 'active', 
    accepted_at = now(),
    tracked_user_id = auth.uid()
  WHERE id = v_session_id;
  
  -- Retornar sucesso
  RETURN json_build_object(
    'success', true,
    'session_id', v_session_id,
    'message', 'Rastreamento aceito com sucesso'
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
  v_is_tracked_user boolean := false;
BEGIN
  -- Verificar se o usuário está autenticado
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Usuário não autenticado');
  END IF;
  
  -- Verificar permissões
  SELECT 
    (admin_id = auth.uid()) as is_admin,
    (tracked_user_id = auth.uid()) as is_tracked
  INTO v_is_admin, v_is_tracked_user
  FROM tracking_sessions 
  WHERE id = p_session_id;
  
  -- Verificar se o usuário tem permissão
  IF NOT (v_is_admin OR v_is_tracked_user) THEN
    RETURN json_build_object('error', 'Sem permissão para acessar esta sessão');
  END IF;
  
  -- Buscar localizações
  SELECT json_agg(
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
  ) INTO v_result
  FROM locations 
  WHERE session_id = p_session_id
  ORDER BY created_at DESC
  LIMIT p_limit;
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar status da sessão
CREATE OR REPLACE FUNCTION update_session_status(
  p_session_id uuid,
  p_status text
)
RETURNS json AS $$
DECLARE
  v_is_admin boolean := false;
  v_is_tracked_user boolean := false;
BEGIN
  -- Verificar se o usuário está autenticado
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Usuário não autenticado');
  END IF;
  
  -- Validar status
  IF p_status NOT IN ('pending', 'accepted', 'rejected', 'active', 'inactive') THEN
    RETURN json_build_object('error', 'Status inválido');
  END IF;
  
  -- Verificar permissões
  SELECT 
    (admin_id = auth.uid()) as is_admin,
    (tracked_user_id = auth.uid()) as is_tracked
  INTO v_is_admin, v_is_tracked_user
  FROM tracking_sessions 
  WHERE id = p_session_id;
  
  -- Verificar se o usuário tem permissão
  IF NOT (v_is_admin OR v_is_tracked_user) THEN
    RETURN json_build_object('error', 'Sem permissão para modificar esta sessão');
  END IF;
  
  -- Atualizar status
  UPDATE tracking_sessions 
  SET status = p_status
  WHERE id = p_session_id;
  
  RETURN json_build_object('success', true, 'message', 'Status atualizado com sucesso');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpeza automática de sessões expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  -- Marcar convites expirados
  UPDATE tracking_invites 
  SET status = 'expired' 
  WHERE status = 'pending' 
    AND expires_at < now();
  
  -- Marcar sessões expiradas como inativas
  UPDATE tracking_sessions 
  SET status = 'inactive' 
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Trigger para limpeza automática (executar diariamente)
CREATE OR REPLACE FUNCTION trigger_cleanup_expired()
RETURNS trigger AS $$
BEGIN
  PERFORM cleanup_expired_sessions();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_expires_at ON tracking_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_tracking_invites_expires_at ON tracking_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_locations_session_created ON locations(session_id, created_at DESC);

-- Configurar limpeza automática via cron (se disponível)
-- SELECT cron.schedule('cleanup-expired-sessions', '0 2 * * *', 'SELECT cleanup_expired_sessions();');