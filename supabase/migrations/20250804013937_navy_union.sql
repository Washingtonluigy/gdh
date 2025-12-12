/*
  # Sistema de Administração e Vouchers

  1. Modificações na tabela profiles
    - Adicionar coluna `allowed_sessions` (padrão 2 para plano básico)
    - Adicionar coluna `is_blocked` para controle de acesso

  2. Nova tabela vouchers
    - `id` (uuid, primary key)
    - `code` (text, unique) - código único do voucher
    - `is_used` (boolean) - se foi usado
    - `used_by_user_id` (uuid) - quem usou
    - `used_at` (timestamp) - quando foi usado
    - `created_at` (timestamp)

  3. Funções RPC para administração
    - generate_voucher: gerar vouchers (apenas admin)
    - redeem_voucher: resgatar voucher (usuários)
    - get_all_user_profiles: listar todos usuários (apenas admin)
    - block_user_access: bloquear/desbloquear usuário (apenas admin)
    - get_user_sessions_count: contar sessões por usuário (apenas admin)

  4. Políticas de segurança
    - RLS configurado para proteger dados sensíveis
    - Apenas admins podem ver todos os perfis
    - Usuários só veem seus próprios dados
*/

-- 1. Adicionar colunas à tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS allowed_sessions INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- 2. Criar tabela vouchers
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE NOT NULL,
  used_by_user_id UUID REFERENCES profiles(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Habilitar RLS na tabela vouchers
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para vouchers (apenas funções RPC podem manipular)
CREATE POLICY "Vouchers são gerenciados apenas por RPC"
  ON vouchers
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 5. Política RLS para admins verem todos os perfis
CREATE POLICY "Admins podem ver todos os perfis"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Função para gerar vouchers (apenas admin)
CREATE OR REPLACE FUNCTION generate_voucher(p_count INTEGER DEFAULT 1)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_profile profiles%ROWTYPE;
  voucher_codes TEXT[] := '{}';
  voucher_code TEXT;
  i INTEGER;
BEGIN
  -- Verificar se o usuário é admin
  SELECT * INTO admin_profile 
  FROM profiles 
  WHERE id = auth.uid() AND role = 'admin';
  
  IF admin_profile.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Acesso negado. Apenas administradores podem gerar vouchers.'
    );
  END IF;

  -- Validar parâmetros
  IF p_count <= 0 OR p_count > 100 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Quantidade deve ser entre 1 e 100 vouchers.'
    );
  END IF;

  -- Gerar vouchers
  FOR i IN 1..p_count LOOP
    -- Gerar código único (8 caracteres aleatórios)
    voucher_code := upper(substring(gen_random_uuid()::text from 1 for 8));
    
    -- Garantir que é único
    WHILE EXISTS (SELECT 1 FROM vouchers WHERE code = voucher_code) LOOP
      voucher_code := upper(substring(gen_random_uuid()::text from 1 for 8));
    END LOOP;
    
    -- Inserir voucher
    INSERT INTO vouchers (code) VALUES (voucher_code);
    
    -- Adicionar à lista de códigos gerados
    voucher_codes := array_append(voucher_codes, voucher_code);
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'voucher_codes', voucher_codes,
    'count', p_count
  );
END;
$$;

-- 7. Função para resgatar voucher
CREATE OR REPLACE FUNCTION redeem_voucher(p_voucher_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile profiles%ROWTYPE;
  voucher_record vouchers%ROWTYPE;
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

  -- Buscar voucher
  SELECT * INTO voucher_record 
  FROM vouchers 
  WHERE code = upper(trim(p_voucher_code));
  
  IF voucher_record.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Código de voucher inválido.'
    );
  END IF;

  -- Verificar se já foi usado
  IF voucher_record.is_used THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este voucher já foi utilizado.'
    );
  END IF;

  -- Marcar voucher como usado
  UPDATE vouchers 
  SET 
    is_used = true,
    used_by_user_id = auth.uid(),
    used_at = now()
  WHERE id = voucher_record.id;

  -- Incrementar allowed_sessions do usuário
  UPDATE profiles 
  SET allowed_sessions = allowed_sessions + 1
  WHERE id = auth.uid();

  RETURN json_build_object(
    'success', true,
    'message', 'Voucher resgatado com sucesso! Você agora pode criar mais um rastreamento.',
    'new_allowed_sessions', user_profile.allowed_sessions + 1
  );
END;
$$;

-- 8. Função para obter todos os perfis de usuário (apenas admin)
CREATE OR REPLACE FUNCTION get_all_user_profiles()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_profile profiles%ROWTYPE;
  users_data JSON;
BEGIN
  -- Verificar se o usuário é admin
  SELECT * INTO admin_profile 
  FROM profiles 
  WHERE id = auth.uid() AND role = 'admin';
  
  IF admin_profile.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Acesso negado. Apenas administradores podem acessar esta função.'
    );
  END IF;

  -- Buscar todos os usuários com contagem de sessões
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'phone', p.phone,
      'role', p.role,
      'allowed_sessions', p.allowed_sessions,
      'is_blocked', p.is_blocked,
      'created_at', p.created_at,
      'active_sessions_count', COALESCE(ts.active_count, 0),
      'total_sessions_count', COALESCE(ts.total_count, 0)
    )
  ) INTO users_data
  FROM profiles p
  LEFT JOIN (
    SELECT 
      admin_id,
      COUNT(*) FILTER (WHERE status IN ('active', 'pending')) as active_count,
      COUNT(*) as total_count
    FROM tracking_sessions 
    GROUP BY admin_id
  ) ts ON p.id = ts.admin_id
  WHERE p.role != 'admin'
  ORDER BY p.created_at DESC;

  RETURN json_build_object(
    'success', true,
    'users', COALESCE(users_data, '[]'::json)
  );
END;
$$;

-- 9. Função para bloquear/desbloquear usuário (apenas admin)
CREATE OR REPLACE FUNCTION block_user_access(p_user_id UUID, p_block_status BOOLEAN)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_profile profiles%ROWTYPE;
  target_user profiles%ROWTYPE;
BEGIN
  -- Verificar se o usuário é admin
  SELECT * INTO admin_profile 
  FROM profiles 
  WHERE id = auth.uid() AND role = 'admin';
  
  IF admin_profile.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Acesso negado. Apenas administradores podem bloquear usuários.'
    );
  END IF;

  -- Verificar se o usuário alvo existe
  SELECT * INTO target_user 
  FROM profiles 
  WHERE id = p_user_id;
  
  IF target_user.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado.'
    );
  END IF;

  -- Não permitir bloquear outros admins
  IF target_user.role = 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Não é possível bloquear outros administradores.'
    );
  END IF;

  -- Atualizar status de bloqueio
  UPDATE profiles 
  SET is_blocked = p_block_status
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'message', CASE 
      WHEN p_block_status THEN 'Usuário bloqueado com sucesso.'
      ELSE 'Usuário desbloqueado com sucesso.'
    END,
    'user_name', target_user.full_name,
    'is_blocked', p_block_status
  );
END;
$$;

-- 10. Função para obter estatísticas de vouchers (apenas admin)
CREATE OR REPLACE FUNCTION get_voucher_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_profile profiles%ROWTYPE;
  stats_data JSON;
BEGIN
  -- Verificar se o usuário é admin
  SELECT * INTO admin_profile 
  FROM profiles 
  WHERE id = auth.uid() AND role = 'admin';
  
  IF admin_profile.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Acesso negado.'
    );
  END IF;

  -- Obter estatísticas
  SELECT json_build_object(
    'total_vouchers', COUNT(*),
    'used_vouchers', COUNT(*) FILTER (WHERE is_used = true),
    'unused_vouchers', COUNT(*) FILTER (WHERE is_used = false),
    'recent_vouchers', json_agg(
      json_build_object(
        'code', code,
        'is_used', is_used,
        'used_by', CASE WHEN is_used THEN p.full_name ELSE null END,
        'used_at', used_at,
        'created_at', created_at
      ) ORDER BY created_at DESC
    ) FILTER (WHERE created_at > now() - interval '30 days')
  ) INTO stats_data
  FROM vouchers v
  LEFT JOIN profiles p ON v.used_by_user_id = p.id;

  RETURN json_build_object(
    'success', true,
    'stats', stats_data
  );
END;
$$;

-- 11. Modificar função create_tracking_session para verificar limite
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
      'error', 'Limite de rastreamentos atingido. Você pode criar no máximo ' || user_profile.allowed_sessions || ' rastreamentos. Para adicionar mais, adquira um voucher adicional por R$ 9,90.',
      'current_sessions', active_sessions_count,
      'allowed_sessions', user_profile.allowed_sessions
    );
  END IF;

  -- Gerar token único
  invite_token := gen_random_uuid()::text;
  
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

  -- Gerar link de convite
  invite_link := 'https://vigialink.com.br?token=' || invite_token;

  RETURN json_build_object(
    'success', true,
    'session_id', new_session.id,
    'invite_token', invite_token,
    'invite_link', invite_link,
    'tracked_user_name', p_tracked_user_name,
    'message', 'Sessão de rastreamento criada com sucesso!'
  );
END;
$$;