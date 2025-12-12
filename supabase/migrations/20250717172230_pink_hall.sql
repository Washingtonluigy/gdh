/*
  # Funcionalidades de Segurança - Geofencing, Emergência e Monitoramento

  1. New Tables
    - `geofence_zones`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to tracking_sessions)
      - `name` (text, nome da zona)
      - `latitude` (numeric, coordenada)
      - `longitude` (numeric, coordenada)
      - `radius` (integer, raio em metros)
      - `type` (text, 'safe' ou 'restricted')
      - `active` (boolean, zona ativa)
      - `created_at` (timestamp)
    
    - `emergency_alerts`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to tracking_sessions)
      - `latitude` (numeric, localização da emergência)
      - `longitude` (numeric, localização da emergência)
      - `accuracy` (numeric, precisão do GPS)
      - `message` (text, mensagem da emergência)
      - `resolved` (boolean, se foi resolvida)
      - `created_at` (timestamp)
    
    - `emergency_notifications`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key)
      - `alert_id` (uuid, foreign key to emergency_alerts)
      - `message` (text, mensagem da notificação)
      - `location` (text, localização formatada)
      - `accuracy` (numeric, precisão)
      - `created_at` (timestamp)
    
    - `family_messages`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to tracking_sessions)
      - `sender_id` (uuid, foreign key to profiles)
      - `message` (text, conteúdo da mensagem)
      - `message_type` (text, tipo da mensagem)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Proper foreign key constraints

  3. Indexes
    - Performance indexes for common queries
    - Spatial indexes for geofencing
*/

-- Tabela de zonas de segurança (geofencing)
CREATE TABLE IF NOT EXISTS geofence_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES tracking_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  latitude numeric(10,8) NOT NULL,
  longitude numeric(11,8) NOT NULL,
  radius integer NOT NULL CHECK (radius > 0 AND radius <= 10000),
  type text NOT NULL CHECK (type IN ('safe', 'restricted')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Tabela de alertas de emergência
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES tracking_sessions(id) ON DELETE CASCADE,
  latitude numeric(10,8) NOT NULL,
  longitude numeric(11,8) NOT NULL,
  accuracy numeric(8,2) DEFAULT 0,
  message text DEFAULT 'Alerta de emergência',
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Tabela de notificações de emergência
CREATE TABLE IF NOT EXISTS emergency_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES tracking_sessions(id) ON DELETE CASCADE,
  alert_id uuid NOT NULL REFERENCES emergency_alerts(id) ON DELETE CASCADE,
  message text NOT NULL,
  location text,
  accuracy numeric(8,2),
  created_at timestamptz DEFAULT now()
);

-- Tabela de mensagens familiares
CREATE TABLE IF NOT EXISTS family_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES tracking_sessions(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'emergency', 'system')),
  created_at timestamptz DEFAULT now()
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_geofence_zones_session_id ON geofence_zones(session_id);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_active ON geofence_zones(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_geofence_zones_location ON geofence_zones(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_session_id ON emergency_alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_created_at ON emergency_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_resolved ON emergency_alerts(resolved) WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_emergency_notifications_session_id ON emergency_notifications(session_id);
CREATE INDEX IF NOT EXISTS idx_emergency_notifications_alert_id ON emergency_notifications(alert_id);

CREATE INDEX IF NOT EXISTS idx_family_messages_session_id ON family_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_family_messages_created_at ON family_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_messages_sender_id ON family_messages(sender_id);

-- Enable RLS
ALTER TABLE geofence_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies para geofence_zones
CREATE POLICY "Users can manage geofence zones for their sessions" ON geofence_zones
  FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT id FROM tracking_sessions 
      WHERE admin_id = auth.uid() OR tracked_user_id = auth.uid()
    )
  );

-- RLS Policies para emergency_alerts
CREATE POLICY "Users can create emergency alerts for their sessions" ON emergency_alerts
  FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM tracking_sessions 
      WHERE tracked_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read emergency alerts for their sessions" ON emergency_alerts
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM tracking_sessions 
      WHERE admin_id = auth.uid()
    )
  );

CREATE POLICY "Users can read their own emergency alerts" ON emergency_alerts
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM tracking_sessions 
      WHERE tracked_user_id = auth.uid()
    )
  );

-- RLS Policies para emergency_notifications
CREATE POLICY "Users can manage emergency notifications for their sessions" ON emergency_notifications
  FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT id FROM tracking_sessions 
      WHERE admin_id = auth.uid() OR tracked_user_id = auth.uid()
    )
  );

-- RLS Policies para family_messages
CREATE POLICY "Users can send messages in their sessions" ON family_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM tracking_sessions 
      WHERE admin_id = auth.uid() OR tracked_user_id = auth.uid()
    )
    AND sender_id = auth.uid()
  );

CREATE POLICY "Users can read messages from their sessions" ON family_messages
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM tracking_sessions 
      WHERE admin_id = auth.uid() OR tracked_user_id = auth.uid()
    )
  );

-- Função para notificar sobre alertas de emergência
CREATE OR REPLACE FUNCTION notify_emergency_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- Notificar via realtime
  PERFORM pg_notify(
    'emergency_alert',
    json_build_object(
      'session_id', NEW.session_id,
      'alert_id', NEW.id,
      'latitude', NEW.latitude,
      'longitude', NEW.longitude,
      'message', NEW.message,
      'created_at', NEW.created_at
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificações de emergência
CREATE TRIGGER emergency_alert_notify
  AFTER INSERT ON emergency_alerts
  FOR EACH ROW
  EXECUTE FUNCTION notify_emergency_alert();

-- Função para limpar alertas antigos (opcional)
CREATE OR REPLACE FUNCTION cleanup_old_alerts()
RETURNS void AS $$
BEGIN
  -- Marcar alertas de mais de 24h como resolvidos
  UPDATE emergency_alerts 
  SET resolved = true 
  WHERE created_at < now() - interval '24 hours' 
    AND resolved = false;
    
  -- Deletar notificações antigas (mais de 7 dias)
  DELETE FROM emergency_notifications 
  WHERE created_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;