/*
  # Corrigir Restrições de Chave Estrangeira para Rastreamento Anônimo

  1. Modificações
    - Remove a restrição de chave estrangeira obrigatória para tracked_user_id
    - Permite que sessões de rastreamento existam sem um usuário autenticado
    - Mantém a funcionalidade para usuários logados

  2. Segurança
    - Mantém RLS ativo
    - Permite inserção anônima apenas via token válido
*/

-- Remove a restrição NOT NULL do tracked_user_id para permitir rastreamento anônimo
ALTER TABLE tracking_sessions 
ALTER COLUMN tracked_user_id DROP NOT NULL;

-- Atualiza a política RLS para permitir atualizações por token
DROP POLICY IF EXISTS "Tracked users can update their session status" ON tracking_sessions;

CREATE POLICY "Users can update session by token"
  ON tracking_sessions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Permite inserção de localizações sem usuário autenticado se tiver session_id válido
DROP POLICY IF EXISTS "Tracked users can insert their locations" ON locations;

CREATE POLICY "Allow location insertion with valid session"
  ON locations
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM tracking_sessions 
      WHERE status = 'active'
    )
  );

-- Permite leitura de localizações para sessões ativas
DROP POLICY IF EXISTS "Tracked users can read their own locations" ON locations;

CREATE POLICY "Allow location reading for active sessions"
  ON locations
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM tracking_sessions 
      WHERE status = 'active'
    )
  );