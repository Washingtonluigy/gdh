/*
  # Adicionar tabelas e colunas faltantes
  
  1. Novas Tabelas
    - `vouchers` - tabela para gerenciar códigos de voucher
  
  2. Modificações na tabela profiles
    - Adicionar coluna `allowed_sessions` (número de sessões permitidas)
    - Adicionar coluna `is_blocked` (se o usuário está bloqueado)
    - Atualizar constraint de role para incluir 'vendor'
  
  3. Segurança
    - RLS habilitado para tabela vouchers
    - Políticas de acesso para vouchers
*/

-- Criar tabela de vouchers se não existir
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  is_used BOOLEAN DEFAULT false,
  used_by_user_id UUID REFERENCES profiles(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas faltantes na tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS allowed_sessions INTEGER DEFAULT 2;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- Atualizar o constraint de role para incluir 'vendor'
DO $$
BEGIN
  -- Remover constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_role_check' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
  
  -- Adicionar novo constraint
  ALTER TABLE profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'tracked', 'vendor'));
END $$;

-- Habilitar RLS na tabela vouchers
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- Políticas para vouchers
CREATE POLICY "Admins can create vouchers"
  ON vouchers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read vouchers for redemption"
  ON vouchers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update vouchers when redeeming"
  ON vouchers
  FOR UPDATE
  TO authenticated
  USING (is_used = false)
  WITH CHECK (is_used = true AND used_by_user_id = auth.uid());