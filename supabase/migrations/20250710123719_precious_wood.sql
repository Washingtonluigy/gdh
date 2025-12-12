/*
  # Corrigir Sistema de Convites

  1. Verificar e corrigir função create_tracking_session
  2. Garantir que convites sejam criados corretamente
  3. Adicionar logs para debug
*/

-- Função melhorada para criar sessão de rastreamento
CREATE OR REPLACE FUNCTION create_tracking_session(
  p_tracked_user_name text,
  p_tracked_user_phone text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_session_id uuid;
  v_invite_token text;
  v_result json;
  v_admin_id uuid;
BEGIN
  -- Verificar se o usuário está autenticado
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('error', 'Usuário não autenticado');
  END IF;
  
  -- Verificar se o perfil existe
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_admin_id) THEN
    -- Tentar criar perfil automaticamente
    PERFORM ensure_profile_exists(v_admin_id);
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
    v_admin_id, 
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
    'admin_id', admin_id,
    'tracked_user_name', tracked_user_name,
    'tracked_user_phone', tracked_user_phone,
    'invite_token', invite_token,
    'invite_link', 'https://' || COALESCE(current_setting('app.base_url', true), 'localhost:5173') || '?token=' || invite_token,
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
      'code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar status dos convites (debug)
CREATE OR REPLACE FUNCTION debug_invite_status(p_token text)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'invite_exists', EXISTS(SELECT 1 FROM tracking_invites WHERE token = p_token),
    'invite_data', (
      SELECT json_build_object(
        'id', id,
        'session_id', session_id,
        'token', token,
        'status', status,
        'created_at', created_at,
        'expires_at', expires_at,
        'is_expired', expires_at < now()
      )
      FROM tracking_invites 
      WHERE token = p_token
    ),
    'session_data', (
      SELECT json_build_object(
        'id', ts.id,
        'admin_id', ts.admin_id,
        'tracked_user_name', ts.tracked_user_name,
        'status', ts.status
      )
      FROM tracking_sessions ts
      JOIN tracking_invites ti ON ti.session_id = ts.id
      WHERE ti.token = p_token
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Limpar convites órfãos (sem sessão correspondente)
DELETE FROM tracking_invites 
WHERE session_id NOT IN (SELECT id FROM tracking_sessions);

-- Verificar se há problemas com tokens duplicados
DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT token, COUNT(*) as cnt
    FROM tracking_invites
    GROUP BY token
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Encontrados % tokens duplicados', duplicate_count;
    
    -- Remover duplicatas, mantendo apenas o mais recente
    DELETE FROM tracking_invites
    WHERE id NOT IN (
      SELECT DISTINCT ON (token) id
      FROM tracking_invites
      ORDER BY token, created_at DESC
    );
  END IF;
END $$;