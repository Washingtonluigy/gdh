import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Satellite, 
  Navigation, 
  Clock, 
  Activity,
  RefreshCw,
  Target,
  Signal,
  Battery,
  Wifi
} from 'lucide-react';
import { TrackingSession, Location } from '../types';

interface GPSTrackerProps {
  session: TrackingSession;
  locations: Location[];
  onBack: () => void;
  onRefresh?: () => void;
  isOnline?: boolean;
}

export const GPSTracker: React.FC<GPSTrackerProps> = ({ 
  session, 
  locations, 
  onBack,
  onRefresh,
  isOnline = true
}) => {
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [signalStrength, setSignalStrength] = useState(4);

  const currentLocation = locations[locations.length - 1];
  const previousLocation = locations[locations.length - 2];

  const parseDate = (dateString: string) => {
    return new Date(dateString);
  };

  // Simular atualizações em tempo real
  useEffect(() => {
    if (isLive && session.status === 'active') {
      const interval = setInterval(() => {
        setLastUpdate(new Date());
        setSignalStrength(Math.floor(Math.random() * 2) + 3); // 3-4 barras
        onRefresh?.();
      }, 15000); // Atualizar a cada 15 segundos

      return () => clearInterval(interval);
    }
  }, [isLive, session.status, onRefresh]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const calculateSpeed = () => {
    if (!currentLocation || !previousLocation) return 0;
    
    // Simular velocidade baseada na diferença de tempo e posição
    const timeDiff = (parseDate(currentLocation.created_at).getTime() - parseDate(previousLocation.created_at).getTime()) / 1000; // segundos
    if (timeDiff === 0) return 0;
    
    // Calcular distância aproximada (simplificada)
    const latDiff = Math.abs(currentLocation.latitude - previousLocation.latitude);
    const lngDiff = Math.abs(currentLocation.longitude - previousLocation.longitude);
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000; // metros aproximados
    
    return Math.round((distance / timeDiff) * 3.6); // km/h
  };

  const getSignalIcon = () => {
    const bars = [];
    for (let i = 1; i <= 4; i++) {
      bars.push(
        <div
          key={i}
          className={`w-1 bg-current ${
            i <= signalStrength ? 'opacity-100' : 'opacity-30'
          }`}
          style={{ height: `${i * 3 + 2}px` }}
        />
      );
    }
    return bars;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={onBack}
                className="mr-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center">
                <Satellite className="w-6 h-6 mr-2" />
                <div>
                  <h1 className="text-lg font-semibold">GPS Tracker - {session.tracked_user_name}</h1>
                  <p className="text-sm text-green-100">
                    {isOnline ? 'Monitoramento em Tempo Real' : 'Modo Offline - Dados Salvos'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Status de Conexão */}
              <div className="flex items-center space-x-2 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="flex items-end space-x-0.5 text-green-300">
                    {getSignalIcon()}
                  </div>
                  <Wifi className="w-4 h-4 text-green-300" />
                </div>
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  isOnline ? 'bg-green-400' : 'bg-orange-400'
                }`}></div>
                <span className="text-green-100">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <Clock className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Última Atualização</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatTime(lastUpdate)}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <Navigation className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Velocidade</p>
                <p className="text-sm font-medium text-gray-900">
                  {calculateSpeed()} km/h
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <Target className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Precisão GPS</p>
                <p className="text-sm font-medium text-gray-900">
                  {currentLocation ? `${currentLocation.accuracy.toFixed(1)}m` : '--'}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                <Activity className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Pontos Coletados</p>
                <p className="text-sm font-medium text-gray-900">
                  {locations.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Mapa Principal */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-red-500" />
                    Localização Atual
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${
                      isOnline ? 'bg-red-500' : 'bg-orange-500'
                    }`}></div>
                    <span className="text-sm font-medium text-red-600">
                      {isOnline ? 'AO VIVO' : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="relative bg-gradient-to-br from-green-50 to-blue-50" style={{ height: '500px' }}>
                {currentLocation ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="relative">
                        <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg">
                          <MapPin className="w-10 h-10 text-white" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm">
                        <p className="font-bold text-gray-900 text-lg mb-2">
                          {session.tracked_user_name}
                        </p>
                        <p className="text-gray-600 text-sm mb-2">
                          {currentLocation.address}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">
                          {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                        </p>
                        <div className="mt-3 flex items-center justify-center space-x-4 text-xs text-gray-500">
                          <span> Precisão: {currentLocation.accuracy.toFixed(1)}m</span>
                          <span>⏰ {formatTime(parseDate(currentLocation.created_at))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Satellite className="w-8 h-8 text-gray-500" />
                      </div>
                      <p className="text-gray-500 text-lg">Aguardando sinal GPS...</p>
                      <p className="text-gray-400 text-sm">Conectando com o dispositivo</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Painel Lateral */}
          <div className="space-y-6">
            {/* Controles */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Controles</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setIsLive(!isLive)}
                  className={`w-full flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-colors ${
                    isLive 
                      ? (isOnline ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-orange-600 text-white hover:bg-orange-700')
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Activity className="w-4 h-4 mr-2" />
                  {isLive 
                    ? (isOnline ? 'Pausar Rastreamento' : 'Pausar (Offline)')
                    : 'Retomar Rastreamento'
                  }
                </button>
                <button
                  onClick={onRefresh}
                  className={`w-full flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-colors ${
                    isOnline 
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
                  disabled={!isOnline}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {isOnline ? 'Atualizar Agora' : 'Sem Conexão'}
                </button>
              </div>
            </div>

            {/* Informações Detalhadas */}
            {currentLocation && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Detalhes da Localização</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Endereço</p>
                    <p className="text-gray-900">{currentLocation.address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Latitude</p>
                      <p className="text-gray-900 font-mono text-sm">{currentLocation.latitude.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Longitude</p>
                      <p className="text-gray-900 font-mono text-sm">{currentLocation.longitude.toFixed(6)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Precisão</p>
                      <p className="text-gray-900">{currentLocation.accuracy.toFixed(1)} metros</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Velocidade</p>
                      <p className="text-gray-900">{calculateSpeed()} km/h</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Última Atualização</p>
                    <p className="text-gray-900">{formatTime(parseDate(currentLocation.created_at))}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Histórico Recente */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Histórico Recente</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {locations.slice(-5).reverse().map((location, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {location.address}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTime(location.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};