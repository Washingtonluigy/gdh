import React from 'react';
import { Battery, Zap, Shield, Navigation, AlertTriangle, CheckCircle } from 'lucide-react';
import { useBatteryMonitor } from '../hooks/useBatteryMonitor';
import { useSpeedMonitor } from '../hooks/useSpeedMonitor';

interface SafetyDashboardProps {
  onBatteryAlert?: (level: number) => void;
  onSpeedAlert?: (alert: any) => void;
  isTracking?: boolean;
}

export const SafetyDashboard: React.FC<SafetyDashboardProps> = ({
  onBatteryAlert,
  onSpeedAlert,
  isTracking = false
}) => {
  const batteryInfo = useBatteryMonitor(onBatteryAlert);
  const { speedInfo, isMonitoring, startSpeedMonitoring, stopSpeedMonitoring } = useSpeedMonitor(60, onSpeedAlert);

  const getBatteryColor = (level: number, charging: boolean) => {
    if (charging) return 'text-green-600';
    if (level > 0.5) return 'text-green-600';
    if (level > 0.2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBatteryIcon = (level: number) => {
    if (level > 0.75) return 'Bateria';
    if (level > 0.5) return 'Bateria';
    if (level > 0.25) return 'Bateria';
    return 'Bateria';
  };

  const getSpeedColor = (speed: number) => {
    if (speed === 0) return 'text-gray-600';
    if (speed < 30) return 'text-green-600';
    if (speed < 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  React.useEffect(() => {
    if (isTracking && !isMonitoring) {
      startSpeedMonitoring();
    } else if (!isTracking && isMonitoring) {
      stopSpeedMonitoring();
    }
  }, [isTracking, isMonitoring, startSpeedMonitoring, stopSpeedMonitoring]);

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
        <Shield className="w-5 h-5 mr-2 text-blue-500" />
        Painel de Segurança
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Status da Bateria */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900 flex items-center">
              <Battery className="w-4 h-4 mr-2" />
              Bateria
            </h4>
            {batteryInfo.supported ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
            )}
          </div>

          {batteryInfo.supported ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-2xl font-bold ${getBatteryColor(batteryInfo.level, batteryInfo.charging)}`}>
                  {getBatteryIcon(batteryInfo.level)} {Math.round(batteryInfo.level * 100)}%
                </span>
                {batteryInfo.charging && (
                  <span className="text-sm text-green-600 font-medium">Carregando</span>
                )}
              </div>

              {/* Barra de bateria */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    batteryInfo.charging ? 'bg-green-500' :
                    batteryInfo.level > 0.5 ? 'bg-green-500' :
                    batteryInfo.level > 0.2 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${batteryInfo.level * 100}%` }}
                ></div>
              </div>

              <div className="text-xs text-gray-600">
                {batteryInfo.level <= 0.2 && !batteryInfo.charging && (
                  <span className="text-red-600 font-medium">Bateria baixa!</span>
                )}
                {batteryInfo.level <= 0.1 && !batteryInfo.charging && (
                  <span className="text-red-600 font-bold">Bateria crítica!</span>
                )}
                {batteryInfo.charging && batteryInfo.chargingTime !== Infinity && (
                  <span>Carregamento completo em {Math.round(batteryInfo.chargingTime / 3600)}h</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-gray-500">Bateria não suportada neste navegador</p>
            </div>
          )}
        </div>

        {/* Monitor de Velocidade */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900 flex items-center">
              <Navigation className="w-4 h-4 mr-2" />
              Velocidade
            </h4>
            {isMonitoring ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-2xl font-bold ${getSpeedColor(speedInfo.currentSpeed)}`}>
                Velocidade {speedInfo.currentSpeed.toFixed(1)} km/h
              </span>
              {speedInfo.isHighSpeed && (
                <span className="text-sm text-red-600 font-bold animate-pulse">ALTA</span>
              )}
            </div>

            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Máxima:</span>
                <span className="font-medium">{speedInfo.maxSpeed.toFixed(1)} km/h</span>
              </div>
              <div className="flex justify-between">
                <span>Média:</span>
                <span className="font-medium">{speedInfo.averageSpeed.toFixed(1)} km/h</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`font-medium ${speedInfo.isMoving ? 'text-blue-600' : 'text-gray-600'}`}>
                  {speedInfo.isMoving ? 'Em movimento' : 'Parado'}
                </span>
              </div>
            </div>

            {speedInfo.isHighSpeed && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Velocidade acima de 60 km/h detectada
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Geral */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">
            Sistema de Segurança
          </span>
          <span className={`text-sm font-bold ${isTracking ? 'text-green-600' : 'text-gray-600'}`}>
            {isTracking ? 'ATIVO' : 'INATIVO'}
          </span>
        </div>
        <div className="text-xs text-blue-700 mt-1">
          {isTracking 
            ? 'Monitoramento ativo - Bateria e velocidade sendo acompanhados'
            : 'Ative o rastreamento para monitorar bateria e velocidade'
          }
        </div>
      </div>
    </div>
  );
};