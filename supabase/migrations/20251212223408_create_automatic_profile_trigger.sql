/*
  # Criar trigger automático para criação de perfis
  
  1. Objetivo
    - Garantir que todo usuário criado no auth.users tenha automaticamente um perfil na tabela profiles
    - Eliminar race conditions e problemas de sincronização entre auth e perfil
    - Tornar o sistema mais robusto e confiável
  
  2. Implementação
    - Function que cria perfil automaticamente após inserção no auth.users
    - Trigger AFTER INSERT na tabela auth.users
    - Define role 'admin' para masterlink@acesso.com, 'vendor' para outros
    - Define allowed_sessions baseado no role (999 para admin, 2 para vendor)
  
  3. Segurança
    - Function executa com SECURITY DEFINER para bypassar RLS durante criação inicial
    - Apenas insere dados, não modifica ou deleta
    - Usa ON CONFLICT DO NOTHING para evitar erros em perfis já existentes
*/

-- Function para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role text;
  sessions_allowed integer;
BEGIN
  -- Determina o role baseado no email
  IF NEW.email = 'masterlink@acesso.com' THEN
    user_role := 'admin';
    sessions_allowed := 999;
  ELSE
    user_role := 'vendor';
    sessions_allowed := 2;
  END IF;

  -- Cria o perfil (ou ignora se já existe)
  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    role,
    allowed_sessions,
    is_blocked,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1), 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    user_role,
    sessions_allowed,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Remove trigger existente se houver
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Cria trigger para executar após criação de usuário
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_for_new_user();

-- Garante que perfis existentes estejam corretos
-- (Cria perfis para qualquer usuário que não tenha)
INSERT INTO public.profiles (
  id,
  full_name,
  phone,
  role,
  allowed_sessions,
  is_blocked,
  created_at,
  updated_at
)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', SPLIT_PART(au.email, '@', 1), 'Usuário'),
  COALESCE(au.raw_user_meta_data->>'phone', ''),
  CASE 
    WHEN au.email = 'masterlink@acesso.com' THEN 'admin'
    ELSE 'vendor'
  END,
  CASE 
    WHEN au.email = 'masterlink@acesso.com' THEN 999
    ELSE 2
  END,
  false,
  NOW(),
  NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
