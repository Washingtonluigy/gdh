/*
  # Habilitar Real-time para Rastreamento GPS

  1. Publicações Real-time
    - Localizações em tempo real
    - Mudanças de status de sessão
    - Notificações de convites

  2. Configurações de Segurança
    - Filtros por usuário
    - Controle de acesso
*/

-- Habilitar realtime para as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE tracking_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE locations;
ALTER PUBLICATION supabase_realtime ADD TABLE tracking_invites;

-- Configurar RLS para realtime
-- As políticas já existentes se aplicam ao realtime também

-- Função para notificar mudanças importantes
CREATE OR REPLACE FUNCTION notify_tracking_changes()
RETURNS trigger AS $$
BEGIN
  -- Notificar sobre mudanças de status de sessão
  IF TG_TABLE_NAME = 'tracking_sessions' AND OLD.status != NEW.status THEN
    PERFORM pg_notify(
      'tracking_session_status_changed',
      json_build_object(
        'session_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'admin_id', NEW.admin_id,
        'tracked_user_id', NEW.tracked_user_id
      )::text
    );
  END IF;
  
  -- Notificar sobre novas localizações
  IF TG_TABLE_NAME = 'locations' AND TG_OP = 'INSERT' THEN
    PERFORM pg_notify(
      'new_location',
      json_build_object(
        'session_id', NEW.session_id,
        'user_id', NEW.user_id,
        'latitude', NEW.latitude,
        'longitude', NEW.longitude,
        'created_at', NEW.created_at
      )::text
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para notificações
CREATE TRIGGER tracking_sessions_notify
  AFTER UPDATE ON tracking_sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_tracking_changes();

CREATE TRIGGER locations_notify
  AFTER INSERT ON locations
  FOR EACH ROW
  EXECUTE FUNCTION notify_tracking_changes();