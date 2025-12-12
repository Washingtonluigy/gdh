import { useState } from 'react';
import { supabase } from '../lib/supabase';

export interface EmergencyAlert {
  id?: string;
  session_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  message?: string;
  resolved: boolean;
  created_at: string;
}

export const useEmergencyAlert = () => {
  const [sending, setSending] = useState(false);

  const sendEmergencyAlert = async (sessionId: string, message?: string): Promise<EmergencyAlert | null> => {
    if (sending) {
      console.warn('Já enviando alerta de emergência...');
      return null;
    }

    setSending(true);

    try {
      // Obter localização atual com alta precisão
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocalização não suportada'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });

      const { coords } = position;
      
      const alertData: Omit<EmergencyAlert, 'id'> = {
        session_id: sessionId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        message: message || 'Alerta de emergência ativado',
        resolved: false,
        created_at: new Date().toISOString()
      };

      console.log('Alerta: Enviando alerta de emergência:', alertData);

      // Salvar no banco
      const { data, error } = await supabase
        .from('emergency_alerts')
        .insert([alertData])
        .select()
        .single();

      if (error) throw error;

      console.log('Alerta de emergência enviado:', data);

      // Enviar notificação em tempo real via Supabase
      const { error: notificationError } = await supabase
        .from('emergency_notifications')
        .insert([{
          session_id: sessionId,
          alert_id: data.id,
          message: `Alerta: EMERGÊNCIA: ${message || 'Botão de pânico ativado'}`,
          location: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
          accuracy: coords.accuracy
        }]);

      if (notificationError) {
        console.warn('Erro ao enviar notificação:', notificationError);
      }

      return data;

    } catch (error) {
      console.error('Erro ao enviar alerta de emergência:', error);
      
      // Fallback: tentar com localização aproximada
      try {
        const alertData: Omit<EmergencyAlert, 'id'> = {
          session_id: sessionId,
          latitude: -23.550520, // São Paulo como fallback
          longitude: -46.633309,
          accuracy: 1000,
          message: (message || 'Alerta de emergência') + ' (localização aproximada)',
          resolved: false,
          created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('emergency_alerts')
          .insert([alertData])
          .select()
          .single();

        if (error) throw error;

        console.log('Alerta enviado com localização aproximada:', data);
        return data;

      } catch (fallbackError) {
        console.error('Erro no fallback:', fallbackError);
        throw new Error('Não foi possível enviar o alerta de emergência');
      }
    } finally {
      setSending(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('emergency_alerts')
        .update({ resolved: true })
        .eq('id', alertId);

      if (error) throw error;
      console.log('Alerta resolvido:', alertId);
    } catch (error) {
      console.error('Erro ao resolver alerta:', error);
      throw error;
    }
  };

  return {
    sendEmergencyAlert,
    resolveAlert,
    sending
  };
};