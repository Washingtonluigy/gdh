/*
  # Melhorar aceitação de convites de rastreamento

  1. Função melhorada para aceitar convites
    - Melhor tratamento de erros
    - Logs para debug
    - Criação automática de perfil

  2. Políticas de segurança atualizadas
    - Permitir usuários rastreados atualizarem sessões
    - Acesso a convites pendentes
    - Atualização de convites durante aceitação
*/

-- Função para garantir que o perfil existe
CREATE OR REPLACE FUNCTION ensure_profile_exists(user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (user_id, 'Usuário Rastreado', 'tracked')
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função melhorada para aceitar convite
CREATE OR REPLACE FUNCTION accept_tracking_invite(p_token text)
RETURNS json AS $$
DECLARE
  v_session_id uuid;
  v_invite_id uuid;
  v_admin_id uuid;
  v_current_user_id uuid;
  v_result json;
BEGIN
  -- Obter ID do usuário atual
  v_current_user_id := auth.uid();
  
  -- Log para debug
  RAISE NOTICE 'Tentando aceitar convite % para usuário %', p_token, v_current_user_id;
  
  -- Verificar se o usuário está autenticado
  IF v_current_user_id IS NULL THEN
    RETURN json_build_object('error', 'Usuário não autenticado');
  END IF;
  
  -- Garantir que o perfil existe
  PERFORM ensure_profile_exists(v_current_user_id);
  
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
  IF v_admin_id = v_current_user_id THEN
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
    tracked_user_id = v_current_user_id
  WHERE id = v_session_id;
  
  -- Atualizar role do usuário para 'tracked' se necessário
  UPDATE profiles 
  SET role = 'tracked'
  WHERE id = v_current_user_id AND role != 'admin';
  
  -- Log de sucesso
  RAISE NOTICE 'Convite aceito com sucesso: sessão %, usuário %', v_session_id, v_current_user_id;
  
  -- Retornar sucesso
  RETURN json_build_object(
    'success', true,
    'session_id', v_session_id,
    'message', 'Rastreamento aceito com sucesso'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao aceitar convite: %', SQLERRM;
    RETURN json_build_object(
      'error', 'Erro interno: ' || SQLERRM,
      'code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover políticas existentes que podem conflitar
DROP POLICY IF EXISTS "Tracked users can update their own sessions" ON tracking_sessions;
DROP POLICY IF EXISTS "Users can read pending invites for acceptance" ON tracking_invites;
DROP POLICY IF EXISTS "Users can update invites they are accepting" ON tracking_invites;

-- Política mais permissiva para usuários rastreados atualizarem sessões
CREATE POLICY "Tracked users can update their own sessions"
  ON tracking_sessions FOR UPDATE
  TO authenticated
  USING (tracked_user_id = auth.uid() OR admin_id = auth.uid())
  WITH CHECK (tracked_user_id = auth.uid() OR admin_id = auth.uid());

-- Permitir que usuários rastreados vejam convites pendentes
CREATE POLICY "Users can read pending invites for acceptance"
  ON tracking_invites FOR SELECT
  TO authenticated
  USING (status = 'pending' AND expires_at > now());

-- Permitir que usuários rastreados atualizem convites que estão aceitando
CREATE POLICY "Users can update invites they are accepting"
  ON tracking_invites FOR UPDATE
  TO authenticated
  USING (status = 'pending' AND expires_at > now())
  WITH CHECK (status IN ('accepted', 'rejected'));