/*
  # Criar usuário administrador simples

  1. Função para criar usuário admin
    - Verifica se o usuário já existe
    - Cria o perfil admin se necessário
    - Atualiza configurações se já existir
*/

-- Função para garantir que o usuário admin existe
CREATE OR REPLACE FUNCTION ensure_admin_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Procurar usuário existente pelo email
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'masterlink@acesso.com';

  -- Se encontrou o usuário, garantir que o perfil está correto
  IF admin_user_id IS NOT NULL THEN
    -- Inserir ou atualizar o perfil
    INSERT INTO profiles (id, role, full_name, allowed_sessions, is_blocked)
    VALUES (admin_user_id, 'admin', 'Master Administrator', 999, false)
    ON CONFLICT (id) 
    DO UPDATE SET
      role = 'admin',
      full_name = 'Master Administrator',
      allowed_sessions = 999,
      is_blocked = false;
    
    RAISE NOTICE 'Perfil admin atualizado para usuário existente: %', admin_user_id;
  ELSE
    RAISE NOTICE 'Usuário masterlink@acesso.com não encontrado. Precisa ser criado via interface.';
  END IF;
END;
$$;

-- Executar a função
SELECT ensure_admin_user();