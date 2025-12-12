/*
  # Correção Final do Sistema de Convites

  1. Verificar e corrigir estrutura das tabelas
  2. Recriar funções com melhor tratamento de erros
  3. Adicionar logs detalhados para debug
  4. Garantir integridade referencial
*/

-- Verificar se as tabelas existem e têm a estrutura correta
DO $$
BEGIN
  -- Verificar tracking_sessions
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tracking_sessions') THEN
    RAISE EXCEPTION 'Tabela tracking_sessions não existe';
  END IF;
  
  -- Verificar tracking_invites
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tracking_invites') THEN
    RAISE EXCEPTION 'Tabela tracking_invites não existe';
  END IF;
  
  -- Verificar se a coluna invite_token existe em tracking_sessions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tracking_sessions' AND column_name = 'invite_token'
  ) THEN
    ALTER TABLE tracking_sessions ADD COLUMN invite_token text UNIQUE;
  END IF;
  
  RAISE NOTICE 'Estrutura das tabelas verificada com sucesso';
END $$;

-- Limpar dados inconsistentes primeiro
DELETE FROM tracking_invites WHERE session_id NOT IN (SELECT id FROM tracking_sessions);
DELETE FROM tracking_sessions WHERE invite_token IS NULL OR invite_token = '';

-- Função para gerar token único garantido
CREATE OR REPLACE FUNCTION generate_guaranteed_unique_token()
RETURNS text AS $$
DECLARE
  new_token text;
  attempts integer := 0;
  max_attempts integer := 100;
BEGIN
  LOOP
    new_token := 'tracking-' || encode(gen_random_bytes(16), 'hex');
    
    -- Verificar se é único em ambas as tabelas
    IF NOT EXISTS (
      SELECT 1 FROM tracking_sessions WHERE invite_token = new_token
      UNION
      SELECT 1 FROM tracking_invites WHERE token = new_token
    ) THEN
      EXIT;
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Não foi possível gerar token único após % tentativas', max_attempts;
    END IF;
  END LOOP;
  
  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Função melhorada para criar sessão com transação atômica
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
  v_session_exists boolean;
  v_invite_exists boolean;
BEGIN
  -- Verificar autenticação
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('error', 'Usuário não autenticado');
  END IF;
  
  -- Validar entrada
  IF p_tracked_user_name IS NULL OR trim(p_tracked_user_name) = '' THEN
    RETURN json_build_object('error', 'Nome do usuário é obrigatório');
  END IF;
  
  -- Garantir que o perfil existe
  PERFORM ensure_profile_exists(v_admin_id);
  
  -- Gerar token único
  v_invite_token := generate_guaranteed_unique_token();
  
  -- Iniciar transação explícita
  BEGIN
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
      trim(p_tracked_user_name), 
      COALESCE(trim(p_tracked_user_phone), ''), 
      v_invite_token,
      'pending',
      now() + interval '7 days'
    )
    RETURNING id INTO v_session_id;
    
    -- Verificar se a sessão foi criada
    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'Falha ao criar sessão de rastreamento';
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
      COALESCE(trim(p_tracked_user_phone), ''),
      'pending',
      now() + interval '7 days'
    )
    RETURNING id INTO v_invite_id;
    
    -- Verificar se o convite foi criado
    IF v_invite_id IS NULL THEN
      RAISE EXCEPTION 'Falha ao criar convite de rastreamento';
    END IF;
    
    -- Verificar integridade dos dados criados
    SELECT EXISTS(SELECT 1 FROM tracking_sessions WHERE id = v_session_id) INTO v_session_exists;
    SELECT EXISTS(SELECT 1 FROM tracking_invites WHERE id = v_invite_id) INTO v_invite_exists;
    
    IF NOT v_session_exists OR NOT v_invite_exists THEN
      RAISE EXCEPTION 'Dados não foram persistidos corretamente';
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
      'expires_at', expires_at,
      'success', true
    ) INTO v_result
    FROM tracking_sessions
    WHERE id = v_session_id;
    
    -- Log de sucesso
    RAISE NOTICE 'Sessão criada com sucesso: ID=%, Token=%', v_session_id, v_invite_token;
    
    RETURN v_result;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback automático em caso de erro
      RAISE EXCEPTION 'Erro na transação: %', SQLERRM;
  END;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro
    RAISE NOTICE 'Erro ao criar sessão: %', SQLERRM;
    
    RETURN json_build_object(
      'error', 'Erro ao criar sessão: ' || SQLERRM,
      'code', SQLSTATE,
      'success', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função melhorada para buscar convite
CREATE OR REPLACE FUNCTION get_invite_by_token(p_token text)
RETURNS json AS $$
DECLARE
  v_result json;
  v_invite_data json;
  v_session_data json;
BEGIN
  -- Log da busca
  RAISE NOTICE 'Buscando convite para token: %', p_token;
  
  -- Buscar dados do convite
  SELECT json_build_object(
    'id', ti.id,
    'session_id', ti.session_id,
    'token', ti.token,
    'status', ti.status,
    'created_at', ti.created_at,
    'expires_at', ti.expires_at,
    'is_expired', ti.expires_at < now(),
    'phone', ti.phone
  ) INTO v_invite_data
  FROM tracking_invites ti
  WHERE ti.token = p_token;
  
  -- Buscar dados da sessão
  SELECT json_build_object(
    'id', ts.id,
    'admin_id', ts.admin_id,
    'tracked_user_name', ts.tracked_user_name,
    'tracked_user_phone', ts.tracked_user_phone,
    'status', ts.status,
    'invite_token', ts.invite_token,
    'profiles', json_build_object(
      'full_name', p.full_name
    )
  ) INTO v_session_data
  FROM tracking_sessions ts
  LEFT JOIN profiles p ON p.id = ts.admin_id
  WHERE ts.invite_token = p_token;
  
  -- Montar resultado
  SELECT json_build_object(
    'token_searched', p_token,
    'invite_found', v_invite_data IS NOT NULL,
    'session_found', v_session_data IS NOT NULL,
    'invite_data', v_invite_data,
    'session_data', v_session_data,
    'tracking_sessions', v_session_data
  ) INTO v_result;
  
  RAISE NOTICE 'Resultado da busca: %', v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para debug completo
CREATE OR REPLACE FUNCTION debug_full_invite_system()
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total_sessions', (SELECT COUNT(*) FROM tracking_sessions),
    'total_invites', (SELECT COUNT(*) FROM tracking_invites),
    'pending_invites', (SELECT COUNT(*) FROM tracking_invites WHERE status = 'pending'),
    'active_sessions', (SELECT COUNT(*) FROM tracking_sessions WHERE status = 'pending'),
    'orphan_invites', (
      SELECT COUNT(*) FROM tracking_invites 
      WHERE session_id NOT IN (SELECT id FROM tracking_sessions)
    ),
    'orphan_sessions', (
      SELECT COUNT(*) FROM tracking_sessions 
      WHERE id NOT IN (SELECT session_id FROM tracking_invites WHERE session_id IS NOT NULL)
    ),
    'recent_sessions', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'tracked_user_name', tracked_user_name,
          'invite_token', invite_token,
          'status', status,
          'created_at', created_at
        )
      )
      FROM tracking_sessions 
      ORDER BY created_at DESC 
      LIMIT 5
    ),
    'recent_invites', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'session_id', session_id,
          'token', token,
          'status', status,
          'created_at', created_at
        )
      )
      FROM tracking_invites 
      ORDER BY created_at DESC 
      LIMIT 5
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar índices para garantir performance
DROP INDEX IF EXISTS idx_tracking_invites_token;
DROP INDEX IF EXISTS idx_tracking_sessions_invite_token;

CREATE UNIQUE INDEX idx_tracking_invites_token ON tracking_invites(token);
CREATE UNIQUE INDEX idx_tracking_sessions_invite_token ON tracking_sessions(invite_token);

-- Verificar integridade final
DO $$
DECLARE
  session_count integer;
  invite_count integer;
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO session_count FROM tracking_sessions;
  SELECT COUNT(*) INTO invite_count FROM tracking_invites;
  SELECT COUNT(*) INTO orphan_count 
  FROM tracking_invites 
  WHERE session_id NOT IN (SELECT id FROM tracking_sessions);
  
  RAISE NOTICE 'Sistema verificado - Sessões: %, Convites: %, Órfãos: %', 
    session_count, invite_count, orphan_count;
    
  IF orphan_count > 0 THEN
    DELETE FROM tracking_invites 
    WHERE session_id NOT IN (SELECT id FROM tracking_sessions);
    RAISE NOTICE 'Removidos % convites órfãos', orphan_count;
  END IF;
END $$;