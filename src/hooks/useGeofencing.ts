import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface GeofenceZone {
  id: string;
  session_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // em metros
  type: 'safe' | 'restricted';
  active: boolean;
  created_at: string;
}

interface GeofenceAlert {
  zone: GeofenceZone;
  type: 'entered' | 'exited';
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: Date;
}

// Função para calcular distância entre dois pontos (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const useGeofencing = (sessionId: string, onGeofenceAlert?: (alert: GeofenceAlert) => void) => {
  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastKnownLocation, setLastKnownLocation] = useState<{latitude: number, longitude: number} | null>(null);

  // Carregar zonas do banco
  const loadZones = useCallback(async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('geofence_zones')
        .select('*')
        .eq('session_id', sessionId)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setZones(data || []);
    } catch (error) {
      console.error('Erro ao carregar zonas:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Criar nova zona
  const createZone = async (zone: Omit<GeofenceZone, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('geofence_zones')
        .insert([zone])
        .select()
        .single();

      if (error) throw error;
      
      setZones(prev => [data, ...prev]);
      console.log('Zona criada:', data);
      return data;
    } catch (error) {
      console.error('Erro ao criar zona:', error);
      throw error;
    }
  };

  // Deletar zona
  const deleteZone = async (zoneId: string) => {
    try {
      const { error } = await supabase
        .from('geofence_zones')
        .delete()
        .eq('id', zoneId);

      if (error) throw error;
      
      setZones(prev => prev.filter(z => z.id !== zoneId));
      console.log('Zona deletada:', zoneId);
    } catch (error) {
      console.error('Erro ao deletar zona:', error);
      throw error;
    }
  };

  // Verificar se localização está dentro de uma zona
  const checkGeofences = useCallback((latitude: number, longitude: number) => {
    if (zones.length === 0) return;

    const currentLocation = { latitude, longitude };
    
    zones.forEach(zone => {
      const distance = calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
      const isInside = distance <= zone.radius;
      
      // Verificar se houve mudança de estado (entrada/saída)
      if (lastKnownLocation) {
        const wasInside = calculateDistance(
          lastKnownLocation.latitude, 
          lastKnownLocation.longitude, 
          zone.latitude, 
          zone.longitude
        ) <= zone.radius;

        if (!wasInside && isInside) {
          // Entrou na zona
          const alert: GeofenceAlert = {
            zone,
            type: 'entered',
            location: currentLocation,
            timestamp: new Date()
          };
          console.log('Alerta: Entrou na zona:', zone.name);
          onGeofenceAlert?.(alert);
        } else if (wasInside && !isInside) {
          // Saiu da zona
          const alert: GeofenceAlert = {
            zone,
            type: 'exited',
            location: currentLocation,
            timestamp: new Date()
          };
          console.log('Alerta: Saiu da zona:', zone.name);
          onGeofenceAlert?.(alert);
        }
      }
    });

    setLastKnownLocation(currentLocation);
  }, [zones, lastKnownLocation, onGeofenceAlert]);

  // Carregar zonas ao inicializar
  useEffect(() => {
    loadZones();
  }, [loadZones]);

  return {
    zones,
    loading,
    createZone,
    deleteZone,
    checkGeofences,
    reloadZones: loadZones
  };
};