import { useState, useEffect } from 'react';

interface BatteryInfo {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  supported: boolean;
}

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener(type: 'chargingchange' | 'chargingtimechange' | 'dischargingtimechange' | 'levelchange', listener: EventListener): void;
  removeEventListener(type: 'chargingchange' | 'chargingtimechange' | 'dischargingtimechange' | 'levelchange', listener: EventListener): void;
}

declare global {
  interface Navigator {
    getBattery?(): Promise<BatteryManager>;
  }
}

export const useBatteryMonitor = (onLowBattery?: (level: number) => void) => {
  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo>({
    level: 1,
    charging: false,
    chargingTime: 0,
    dischargingTime: 0,
    supported: false
  });

  useEffect(() => {
    let battery: BatteryManager | null = null;

    const updateBatteryInfo = (batteryManager: BatteryManager) => {
      const newInfo = {
        level: batteryManager.level,
        charging: batteryManager.charging,
        chargingTime: batteryManager.chargingTime,
        dischargingTime: batteryManager.dischargingTime,
        supported: true
      };

      setBatteryInfo(newInfo);

      // Alerta de bateria baixa (20% e não carregando)
      if (batteryManager.level <= 0.2 && !batteryManager.charging) {
        console.log('Bateria Bateria baixa detectada:', Math.round(batteryManager.level * 100) + '%');
        onLowBattery?.(Math.round(batteryManager.level * 100));
      }

      // Alerta de bateria crítica (10%)
      if (batteryManager.level <= 0.1 && !batteryManager.charging) {
        console.log('Alerta: Bateria crítica:', Math.round(batteryManager.level * 100) + '%');
        onLowBattery?.(Math.round(batteryManager.level * 100));
      }
    };

    const initBattery = async () => {
      if ('getBattery' in navigator && navigator.getBattery) {
        try {
          battery = await navigator.getBattery();
          updateBatteryInfo(battery);

          // Event listeners
          const handleChargingChange = () => updateBatteryInfo(battery!);
          const handleLevelChange = () => updateBatteryInfo(battery!);

          battery.addEventListener('chargingchange', handleChargingChange);
          battery.addEventListener('levelchange', handleLevelChange);
          battery.addEventListener('chargingtimechange', handleChargingChange);
          battery.addEventListener('dischargingtimechange', handleChargingChange);

          return () => {
            if (battery) {
              battery.removeEventListener('chargingchange', handleChargingChange);
              battery.removeEventListener('levelchange', handleLevelChange);
              battery.removeEventListener('chargingtimechange', handleChargingChange);
              battery.removeEventListener('dischargingtimechange', handleChargingChange);
            }
          };
        } catch (error) {
          console.warn('Battery API não suportada:', error);
          setBatteryInfo(prev => ({ ...prev, supported: false }));
        }
      } else {
        console.warn('Battery API não disponível neste navegador');
        setBatteryInfo(prev => ({ ...prev, supported: false }));
      }
    };

    initBattery();
  }, [onLowBattery]);

  return batteryInfo;
};