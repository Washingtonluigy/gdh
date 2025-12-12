/*
  # Corrigir problema de criação de convites

  1. Verificar e corrigir estrutura das tabelas
  2. Melhorar função de criação de sessão
  3. Garantir que convites sejam criados corretamente
  4. Adicionar logs de debug
*/

-- Verificar se as tabelas existem e têm a estrutura correta
DO $$
BEGIN
  -- Verificar se tracking_sessions existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tracking_sessions') THEN
    RAISE EXCEPTION 'Tabela tracking_sessions não existe';
  END IF;
  
  -- Verificar se tracking_invites existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tracking_invites') THEN
    RAISE EXCEPTION 'Tabela tracking_invites não existe';
  END IF;
END $$;

-- Função melhorada para criar sessão com melhor tratamento de erros
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
  v_invite_id uuid;
BEGIN
  -- Verificar autenticação
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('error', 'Usuário não autenticado');
  END IF;
  
  -- Garantir que o perfil existe
  PERFORM ensure_profile_exists(v_admin_id);
  
  -- Gerar token único
  v_invite_token := 'tracking-' || encode(gen_random_bytes(16), 'hex');
  
  -- Verificar se o token é único
  WHILE EXISTS (SELECT 1 FROM tracking_sessions WHERE invite_token = v_invite_token) LOOP
    v_invite_token := 'tracking-' || encode(gen_random_bytes(16), 'hex');
  END LOOP;
  
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
    COALESCE(p_tracked_user_phone, ''), 
    v_invite_token,
    'pending',
    now() + interval '7 days'
  )
  RETURNING id INTO v_session_id;
  
  -- Verificar se a sessão foi criada
  IF v_session_id IS NULL THEN
    RETURN json_build_object('error', 'Falha ao criar sessão de rastreamento');
  END IF;
  
  -- Criar convite correspondente
  INSERT INTO tracking_invites (
    session_id, 
    token, 
    phone, 
    status,
    expires_at
  )
  VALUES (
    v_session_id, 
    v_invite_token, 
    COALESCE(p_tracked_user_phone, ''),
    'pending',
    now() + interval '7 days'
  )
  RETURNING id INTO v_invite_id;
  
  -- Verificar se o convite foi criado
  IF v_invite_id IS NULL THEN
    -- Se falhou ao criar convite, remover a sessão
    DELETE FROM tracking_sessions WHERE id = v_session_id;
    RETURN json_build_object('error', 'Falha ao criar convite de rastreamento');
  END IF;
  
  -- Retornar dados da sessão
  SELECT json_build_object(
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
    -- Em caso de erro, tentar limpar dados parciais
    IF v_session_id IS NOT NULL THEN
      DELETE FROM tracking_sessions WHERE id = v_session_id;
    END IF;
    
    RETURN json_build_object(
      'error', 'Erro ao criar sessão: ' || SQLERRM,
      'code', SQLSTATE,
      'detail', 'Verifique se todas as tabelas existem e têm as permissões corretas'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar convite com mais detalhes de debug
CREATE OR REPLACE FUNCTION get_invite_details(p_token text)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'token_searched', p_token,
    'invite_found', EXISTS(SELECT 1 FROM tracking_invites WHERE token = p_token),
    'session_found', EXISTS(
      SELECT 1 FROM tracking_sessions ts 
      JOIN tracking_invites ti ON ti.session_id = ts.id 
      WHERE ti.token = p_token
    ),
    'invite_data', (
      SELECT json_build_object(
        'id', ti.id,
        'session_id', ti.session_id,
        'token', ti.token,
        'status', ti.status,
        'created_at', ti.created_at,
        'expires_at', ti.expires_at,
        'is_expired', ti.expires_at < now(),
        'phone', ti.phone
      )
      FROM tracking_invites ti
      WHERE ti.token = p_token
      LIMIT 1
    ),
    'session_data', (
      SELECT json_build_object(
        'id', ts.id,
        'admin_id', ts.admin_id,
        'tracked_user_name', ts.tracked_user_name,
        'tracked_user_phone', ts.tracked_user_phone,
        'status', ts.status,
        'invite_token', ts.invite_token
      )
      FROM tracking_sessions ts
      WHERE ts.invite_token = p_token
      LIMIT 1
    ),
    'total_invites', (SELECT COUNT(*) FROM tracking_invites),
    'total_sessions', (SELECT COUNT(*) FROM tracking_sessions)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Limpar dados inconsistentes
DO $$
BEGIN
  -- Remover convites órfãos
  DELETE FROM tracking_invites 
  WHERE session_id NOT IN (SELECT id FROM tracking_sessions);
  
  -- Remover sessões sem convite correspondente
  DELETE FROM tracking_sessions 
  WHERE id NOT IN (SELECT session_id FROM tracking_invites WHERE session_id IS NOT NULL);
  
  RAISE NOTICE 'Limpeza de dados concluída';
END $$;

-- Verificar integridade dos dados
DO $$
DECLARE
  session_count integer;
  invite_count integer;
  orphan_invites integer;
  orphan_sessions integer;
BEGIN
  SELECT COUNT(*) INTO session_count FROM tracking_sessions;
  SELECT COUNT(*) INTO invite_count FROM tracking_invites;
  
  SELECT COUNT(*) INTO orphan_invites 
  FROM tracking_invites 
  WHERE session_id NOT IN (SELECT id FROM tracking_sessions);
  
  SELECT COUNT(*) INTO orphan_sessions 
  FROM tracking_sessions 
  WHERE id NOT IN (SELECT session_id FROM tracking_invites WHERE session_id IS NOT NULL);
  
  RAISE NOTICE 'Sessões: %, Convites: %, Convites órfãos: %, Sessões órfãs: %', 
    session_count, invite_count, orphan_invites, orphan_sessions;
END $$;