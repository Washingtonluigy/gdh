import { useState, useEffect, useCallback } from 'react';

interface SpeedInfo {
  currentSpeed: number; // km/h
  maxSpeed: number; // km/h
  averageSpeed: number; // km/h
  isMoving: boolean;
  isHighSpeed: boolean; // > 60 km/h
}

interface SpeedAlert {
  speed: number;
  timestamp: Date;
  location: {
    latitude: number;
    longitude: number;
  };
}

export const useSpeedMonitor = (
  speedThreshold: number = 60, // km/h
  onSpeedAlert?: (alert: SpeedAlert) => void
) => {
  const [speedInfo, setSpeedInfo] = useState<SpeedInfo>({
    currentSpeed: 0,
    maxSpeed: 0,
    averageSpeed: 0,
    isMoving: false,
    isHighSpeed: false
  });

  const [watchId, setWatchId] = useState<number | null>(null);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const [lastAlertTime, setLastAlertTime] = useState<number>(0);

  const startSpeedMonitoring = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocalização não suportada');
      return;
    }

    if (watchId) {
      console.log('Monitoramento de velocidade já ativo');
      return;
    }

    console.log('Velocidade Iniciando monitoramento de velocidade...');

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { coords } = position;
        
        // Velocidade em m/s (pode ser null)
        const speedMs = coords.speed;
        
        if (speedMs !== null && speedMs >= 0) {
          // Converter para km/h
          const speedKmh = speedMs * 3.6;
          
          console.log('Velocidade Velocidade detectada:', speedKmh.toFixed(1), 'km/h');
          
          // Atualizar histórico
          setSpeedHistory(prev => {
            const newHistory = [...prev, speedKmh].slice(-10); // Manter últimas 10 leituras
            
            // Calcular estatísticas
            const maxSpeed = Math.max(...newHistory);
            const averageSpeed = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;
            const isMoving = speedKmh > 1; // > 1 km/h considera movimento
            const isHighSpeed = speedKmh > speedThreshold;
            
            setSpeedInfo({
              currentSpeed: speedKmh,
              maxSpeed,
              averageSpeed,
              isMoving,
              isHighSpeed
            });
            
            // Alerta de velocidade alta (máximo 1 por minuto)
            const now = Date.now();
            if (isHighSpeed && (now - lastAlertTime) > 60000) {
              console.log('Alerta: Velocidade alta detectada:', speedKmh.toFixed(1), 'km/h');
              
              const alert: SpeedAlert = {
                speed: speedKmh,
                timestamp: new Date(),
                location: {
                  latitude: coords.latitude,
                  longitude: coords.longitude
                }
              };
              
              onSpeedAlert?.(alert);
              setLastAlertTime(now);
            }
            
            return newHistory;
          });
        } else {
          // Velocidade não disponível, assumir parado
          setSpeedInfo(prev => ({
            ...prev,
            currentSpeed: 0,
            isMoving: false,
            isHighSpeed: false
          }));
        }
      },
      (error) => {
        console.error('Erro no monitoramento de velocidade:', error);
        
        // Reset em caso de erro
        setSpeedInfo({
          currentSpeed: 0,
          maxSpeed: 0,
          averageSpeed: 0,
          isMoving: false,
          isHighSpeed: false
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    setWatchId(id);
    console.log('Monitoramento de velocidade iniciado, ID:', id);
  }, [watchId, speedThreshold, onSpeedAlert, lastAlertTime]);

  const stopSpeedMonitoring = useCallback(() => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      console.log('Parar Monitoramento de velocidade parado');
      
      // Reset
      setSpeedInfo({
        currentSpeed: 0,
        maxSpeed: 0,
        averageSpeed: 0,
        isMoving: false,
        isHighSpeed: false
      });
      setSpeedHistory([]);
    }
  }, [watchId]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    speedInfo,
    isMonitoring: watchId !== null,
    startSpeedMonitoring,
    stopSpeedMonitoring
  };
};