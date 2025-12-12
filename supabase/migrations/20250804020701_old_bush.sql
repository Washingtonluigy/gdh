/*
  # Corrigir recursão infinita nas políticas RLS da tabela profiles

  1. Problema
    - Políticas RLS da tabela `profiles` estão causando recursão infinita
    - Isso acontece quando uma política consulta a própria tabela `profiles` para determinar permissões

  2. Solução
    - Remover todas as políticas RLS existentes da tabela `profiles`
    - Criar novas políticas simples que não causem recursão
    - Usar `auth.uid()` diretamente em vez de consultar a tabela `profiles`

  3. Novas Políticas
    - Usuários podem ler e atualizar apenas seu próprio perfil
    - Usuários podem inserir apenas seu próprio perfil
    - Sem consultas recursivas à tabela `profiles`
*/

-- Remover todas as políticas existentes da tabela profiles
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Criar novas políticas simples sem recursão
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);