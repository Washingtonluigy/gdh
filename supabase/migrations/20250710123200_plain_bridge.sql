/*
  # Adicionar coluna phone à tabela profiles

  1. Alterações na Tabela
    - Adicionar coluna `phone` (text, opcional) à tabela `profiles`
    - Manter compatibilidade com dados existentes

  2. Segurança
    - Manter políticas RLS existentes
    - A coluna phone será opcional (nullable)
*/

-- Adicionar coluna phone à tabela profiles se ela não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
END $$;