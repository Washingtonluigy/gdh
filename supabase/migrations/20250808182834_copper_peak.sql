/*
  # Corrigir políticas RLS para vouchers

  1. Políticas
    - Permitir que admins criem vouchers
    - Permitir que usuários autenticados leiam vouchers para resgate
    - Permitir que usuários atualizem vouchers ao resgatar

  2. Segurança
    - Apenas admins podem criar vouchers
    - Usuários podem resgatar vouchers válidos
    - Proteção contra uso indevido
*/

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Vouchers são gerenciados apenas por RPC" ON vouchers;
DROP POLICY IF EXISTS "Admins can create vouchers" ON vouchers;
DROP POLICY IF EXISTS "Users can read vouchers for redemption" ON vouchers;
DROP POLICY IF EXISTS "Users can update vouchers when redeeming" ON vouchers;

-- Política para admins criarem vouchers
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

-- Política para usuários lerem vouchers (necessário para verificar se existe)
CREATE POLICY "Users can read vouchers for redemption"
  ON vouchers
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para usuários atualizarem vouchers ao resgatar
CREATE POLICY "Users can update vouchers when redeeming"
  ON vouchers
  FOR UPDATE
  TO authenticated
  USING (
    -- Pode atualizar se o voucher não foi usado ainda
    is_used = false
  )
  WITH CHECK (
    -- Só pode marcar como usado e definir quem usou
    is_used = true AND used_by_user_id = auth.uid()
  );

-- Garantir que RLS está habilitado
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;