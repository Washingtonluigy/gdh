/*
  # Trigger para criar perfil automaticamente

  1. Função para criar perfil automaticamente quando usuário se registra
  2. Trigger que executa após inserção na tabela auth.users
*/

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'admin'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar a função
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para garantir que perfil existe
CREATE OR REPLACE FUNCTION public.ensure_profile_exists(user_id uuid)
RETURNS void AS $$
DECLARE
  user_record auth.users%ROWTYPE;
BEGIN
  -- Buscar dados do usuário
  SELECT * INTO user_record FROM auth.users WHERE id = user_id;
  
  -- Inserir perfil se não existir
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    user_id,
    COALESCE(user_record.raw_user_meta_data->>'full_name', user_record.email),
    COALESCE(user_record.raw_user_meta_data->>'phone', ''),
    'admin'
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;