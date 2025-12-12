import React, { useState, useEffect } from 'react';
import { MapPin, Shield, CheckCircle, StopCircle, Activity, Clock, AlertTriangle } from 'lucide-react';
import { EmergencyButton } from './EmergencyButton';
import { SafetyDashboard } from './SafetyDashboard';
import { GeofenceManager } from './GeofenceManager';
import { useGeofencing } from '../hooks/useGeofencing';

interface TrackingActiveProps {
  onStop: () => void;
  isOnline?: boolean;
  adminName?: string;
  tokenAccepted?: boolean;
  sessionId?: string;
}

export const TrackingActive: React.FC<TrackingActiveProps> = ({ 
  onStop, 
  isOnline = true, 
  adminName = 'Administrador',
  tokenAccepted = false,
  sessionId
}) => {
  console.log('TrackingActive renderizado:', { isOnline, adminName });
  
  const [isTracking, setIsTracking] = useState(tokenAccepted);
  const [locationCount, setLocationCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentLocation, setCurrentLocation] = useState<string>('Obtendo localização...');
  const [gpsLocation, setGpsLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Geofencing
  const { checkGeofences } = useGeofencing(sessionId || '', (alert) => {
    const message = `Alerta: ${alert.type === 'entered' ? 'Entrou' : 'Saiu'} da zona: ${alert.zone.name}`;
    setNotifications(prev => [message, ...prev.slice(0, 4)]);
    console.log('Alerta de geofencing:', message);
  });

  // Update tracking state when tokenAccepted changes
  useEffect(() => {
    setIsTracking(tokenAccepted);
  }, [tokenAccepted]);

  useEffect(() => {
    console.log(' Iniciando simulação de localização...');
    
    // Simulate location updates
    const interval = setInterval(() => {
      if (isTracking) {
        setLocationCount(prev => prev + 1);
        setLastUpdate(new Date());
        console.log(' Localização atualizada:', locationCount + 1);
        
        // Simulate getting address
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude, accuracy } = position.coords;
              const location = { latitude, longitude };
              
              setGpsLocation(location);
              setCurrentLocation(`GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy?.toFixed(1)}m)`);
              
              // Verificar geofencing
              checkGeofences(latitude, longitude);
              
              console.log(' GPS real obtido:', { latitude, longitude });
            },
            () => {
              setCurrentLocation('Localização não disponível');
              console.log(' GPS não disponível, usando mock');
            }
          );
        }
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [isTracking]);

  const handleBatteryAlert = (level: number) => {
    const message = level <= 10 
      ? `Alerta: Bateria crítica: ${level}%` 
      : `Bateria baixa: ${level}%`;
    setNotifications(prev => [message, ...prev.slice(0, 4)]);
    console.log('Bateria Alerta de bateria:', message);
  };

  const handleSpeedAlert = (alert: any) => {
    const message = `Velocidade Velocidade alta: ${alert.speed.toFixed(1)} km/h`;
    setNotifications(prev => [message, ...prev.slice(0, 4)]);
    console.log('Velocidade Alerta de velocidade:', message);
  };

  const handleEmergencyAlert = (alert: any) => {
    const message = `EMERGÊNCIA ATIVADA - Localização enviada`;
    setNotifications(prev => [message, ...prev.slice(0, 4)]);
    console.log('Alerta: Alerta de emergência:', alert);
  };

  const handleStop = () => {
    console.log('Parar Parando rastreamento...');
    setIsTracking(false);
    setTimeout(() => {
      console.log('Parar Redirecionando para login...');
      onStop();
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className={`rounded-full p-4 w-20 h-20 flex items-center justify-center mx-auto mb-4 ${
            isTracking ? 'bg-green-100 animate-pulse' : 'bg-gray-100'
          }`}>
            {isTracking ? (
              <Activity className="w-10 h-10 text-green-600" />
            ) : (
              <CheckCircle className="w-10 h-10 text-gray-600" />
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
            {tokenAccepted ? 'Proteção Ativa' : 'Aguardando Ativação'}
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {tokenAccepted 
              ? `Você está sendo protegido por: ${adminName}. Sua localização está sendo compartilhada com segurança.`
              : 'Aceite os termos para ativar a proteção'
            }
          </p>
        </div>

        {tokenAccepted && (
          <>
            {/* Mensagem de boas-vindas */}
            <div className="mb-4">
              <EmergencyButton 
                sessionId={sessionId || ''}
                onEmergencyAlert={handleEmergencyAlert}
                disabled={!tokenAccepted}
              />
            </div>

            {/* Notificações recentes */}
            {notifications.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <h4 className="font-medium text-yellow-900 mb-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Alertas Recentes
                </h4>
                {notifications.slice(0, 3).map((notification, index) => (
                  <p key={index} className="text-sm text-yellow-800 mb-1">{notification}</p>
                ))}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm sm:text-base font-medium text-blue-900">Sistema Ativado com Sucesso!</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Sua proteção está ativa. O sistema funciona automaticamente, mesmo sem internet.
                  </p>
                </div>
              </div>
            </div>

            {/* Painel de Segurança */}
            <div className="mb-6">
              <SafetyDashboard 
                onBatteryAlert={handleBatteryAlert}
                onSpeedAlert={handleSpeedAlert}
                isTracking={tokenAccepted}
              />
            </div>

            {/* Gerenciador de Zonas */}
            <div className="mb-6">
              <GeofenceManager 
                sessionId={sessionId || ''}
                currentLocation={gpsLocation}
                onGeofenceAlert={(alert) => {
                  const message = `Alerta: ${alert.type === 'entered' ? 'Entrou' : 'Saiu'} da zona: ${alert.zone.name}`;
                  setNotifications(prev => [message, ...prev.slice(0, 4)]);
                }}
              />
            </div>

            {/* Status de conexão */}
            <div className={`border rounded-lg p-4 mb-6 ${
              isOnline ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
            }`}>
              <div className="flex items-start">
                <div className={`w-5 h-5 mr-2 mt-0.5 ${
                  isOnline ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {isOnline ? '' : ''}
                </div>
                <div>
                  <p className={`text-sm sm:text-base font-medium ${
                    isOnline ? 'text-green-900' : 'text-orange-900'
                  }`}>
                    {isOnline ? 'Online - Sincronização Ativa' : 'Offline - Dados Salvos Localmente'}
                  </p>
                  <p className={`text-xs mt-1 ${
                    isOnline ? 'text-green-700' : 'text-orange-700'
                  }`}>
                    {isOnline 
                      ? 'Sua localização está sendo enviada em tempo real'
                      : 'Sua localização está sendo salva e será enviada quando voltar online'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Status Cards */}
            <div className="space-y-4 mb-8">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg mr-3">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm sm:text-base font-medium text-green-900">Localização Atual</p>
                    <p className="text-xs sm:text-sm text-green-700 break-words font-mono">{currentLocation}</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm sm:text-base font-medium text-blue-900">Última Atualização</p>
                    <p className="text-xs sm:text-sm text-blue-700">
                      {lastUpdate.toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg mr-3">
                    <Activity className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm sm:text-base font-medium text-purple-900">Pontos Enviados</p>
                    <p className="text-xs sm:text-sm text-purple-700">{locationCount} localizações</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Indicator */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                <span className="text-sm sm:text-base font-medium text-gray-700">
                  {isOnline ? 'AO VIVO' : 'SALVANDO OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-gray-500 text-center mt-1">
                {isOnline 
                  ? 'Atualizações automáticas a cada 30 segundos'
                  : 'Dados serão sincronizados quando voltar online'
                }
              </p>
            </div>

            {/* Privacy Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm sm:text-base font-medium text-yellow-900">Privacidade Protegida</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Seus dados são criptografados e compartilhados apenas com {adminName}.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {!tokenAccepted && (
          <>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">Aguardando Ativação</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Este link ainda não foi aceito. Você precisa aceitar os termos para ativar a proteção.
                  </p>
                </div>
              </div>
            </div>

            {/* Botão de emergência desabilitado */}
            <div className="mb-4">
              <EmergencyButton 
               sessionId={sessionId || ''}
                onEmergencyAlert={handleEmergencyAlert}
                disabled={true}
              />
            </div>
          </>
        )}

        {/* Action Button */}
        <button
          onClick={handleStop}
          disabled={!tokenAccepted}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center text-base ${
            tokenAccepted
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <StopCircle className="w-5 h-5 mr-2" />
          {tokenAccepted ? 'Desativar Proteção' : 'Aguardando Ativação'}
        </button>

        {!tokenAccepted && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Aceite os termos para ativar a proteção
          </p>
        )}

        {/* Instructions */}
        {tokenAccepted && (
          <div className="mt-6 text-center">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-700 font-medium mb-1">
                Sistema de Proteção Completo Ativo
              </p>
              <div className="text-xs text-green-600 space-y-1">
                <p>Monitoramento de bateria ativo</p>
                <p>Detecção de velocidade ativa</p>
                <p>Zonas de segurança configuráveis</p>
                <p>Botão de pânico disponível</p>
                <p>GPS em tempo real funcionando</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};