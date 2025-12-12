import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  ArrowLeft, 
  Clock, 
  Navigation, 
  Activity,
  RefreshCw,
  Calendar,
  Target,
  Satellite,
  Radio,
  Eye,
  Zap
} from 'lucide-react';
import { TrackingSession, Location } from '../types';

interface LocationViewerProps {
  session: TrackingSession;
  locations: Location[];
  onBack: () => void;
  onClearHistory?: () => void;
  isOnline?: boolean;
}

export const LocationViewer: React.FC<LocationViewerProps> = ({ 
  session, 
  locations, 
  onBack,
  onClearHistory,
  isOnline = true
}) => {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Garantir que temos a localização mais recente
  const currentLocation = locations && locations.length > 0 ? locations[locations.length - 1] : null;
  const last24Hours = locations ? locations.filter(
    loc => Date.now() - parseDate(loc.created_at).getTime() < 24 * 60 * 60 * 1000
  ) : [];

  console.log(' LocationViewer - Dados recebidos:', {
    session: session?.id,
    locationsCount: locations?.length || 0,
    currentLocation: currentLocation ? {
      id: currentLocation.id,
      address: currentLocation.address,
      lat: currentLocation.latitude,
      lng: currentLocation.longitude,
      time: currentLocation.created_at
    } : null
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const parseDate = (dateString: string) => {
    return new Date(dateString);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const calculateDistance = (loc1: Location, loc2: Location) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleClearHistory = () => {
    if (confirm('Excluir Tem certeza que deseja limpar todo o histórico?\n\nTodos os dados de localização serão perdidos PERMANENTEMENTE.\n\nEsta ação NÃO pode ser desfeita!')) {
      onClearHistory?.();
    }
  };

  const handleRefresh = () => {
    setLastRefresh(new Date());
    window.location.reload(); // Força um refresh completo
  };

  // Auto-refresh a cada 30 segundos se estiver ativo
  useEffect(() => {
    if (autoRefresh && session.status === 'active') {
      const interval = setInterval(() => {
        setLastRefresh(new Date());
        console.log('Auto-refresh ativado');
        // Em uma implementação real, recarregaria os dados
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, session.status]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-green-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 sm:h-16 space-y-2 sm:space-y-0">
            <div className="flex items-center">
              <button
                onClick={onBack}
                className="mr-2 sm:mr-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center">
                <Eye className="w-6 h-6 text-white mr-2" />
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-white">
                     {session.tracked_user_name}
                  </h1>
                  <p className="text-xs sm:text-sm text-blue-100">
                    {session.tracked_user_phone} • {session.status === 'active' ? 'GPS ATIVO' : 'INATIVO'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <div className="flex bg-white/20 rounded-lg p-1 w-full sm:w-auto">
                <button
                  onClick={() => setViewMode('map')}
                  className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'map'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-white hover:text-blue-200'
                  }`}
                >
                  MAPA Mapa
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-white hover:text-blue-200'
                  }`}
                >
                  Link Lista
                </button>
              </div>
              <div className="flex items-center text-xs sm:text-sm text-white">
                <Activity className="w-4 h-4 mr-1" />
                {session.status === 'active' ? (
                  <span className="font-bold"> ATIVO {!isOnline && '(Offline)'}</span>
                ) : (
                  <span>Inativo {session.status === 'pending' ? 'AGUARDANDO' : 'INATIVO'}</span>
                )}
              </div>
              {!isOnline && (
                <div className="flex items-center text-orange-300 text-xs sm:text-sm">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mr-2 animate-pulse"></div>
                  Offline
                </div>
              )}
              {session.status === 'active' && (
                <label className="flex items-center text-xs sm:text-sm text-white">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="mr-2"
                  />
                  Auto-atualizar
                </label>
              )}
              <button
                onClick={handleRefresh}
                className="bg-white/20 text-white px-3 py-2 rounded-lg hover:bg-white/30 transition-colors flex items-center text-xs sm:text-sm w-full sm:w-auto justify-center"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center">
              <div className="p-1 sm:p-2 bg-red-100 rounded-lg mr-2 sm:mr-3">
                <Target className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500"> Localização Atual</p>
                <p className="text-xs sm:text-sm font-bold text-red-600 break-words">
                  {currentLocation ? currentLocation.address : '🔍 Aguardando GPS...'}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="p-1 sm:p-2 bg-blue-100 rounded-lg mr-2 sm:mr-3">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">⏰ Última Atualização</p>
                <p className="text-xs sm:text-sm font-bold text-blue-600">
                  {currentLocation ? formatTime(parseDate(currentLocation.created_at)) : '--:--'}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="p-1 sm:p-2 bg-purple-100 rounded-lg mr-2 sm:mr-3">
                <Navigation className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500"> Precisão GPS</p>
                <p className="text-xs sm:text-sm font-bold text-purple-600">
                  {currentLocation ? `${currentLocation.accuracy.toFixed(1)}m` : '--'}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="p-1 sm:p-2 bg-yellow-100 rounded-lg mr-2 sm:mr-3">
                <Calendar className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">HIST Pontos (24h)</p>
                <p className="text-xs sm:text-sm font-bold text-yellow-600">
                  {last24Hours.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {viewMode === 'map' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Mapa Simulado */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-3 sm:p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-green-50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-900">
                      {session.status === 'active' 
                        ? (isOnline ? ' LOCALIZAÇÃO EM TEMPO REAL' : 'ÚLTIMA LOCALIZAÇÃO (OFFLINE)')
                        : ' ÚLTIMA LOCALIZAÇÃO CONHECIDA'
                      }
                    </h3>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                      {session.status === 'active' && (
                        <div className={`flex items-center text-xs sm:text-sm font-bold ${
                          isOnline ? 'text-red-600' : 'text-orange-600'
                        }`}>
                          <div className={`w-3 h-3 rounded-full mr-2 animate-pulse ${
                            isOnline ? 'bg-red-500' : 'bg-orange-500'
                          }`}></div>
                          {isOnline ? 'AO VIVO' : 'OFFLINE'}
                        </div>
                      )}
                      <button 
                        onClick={handleRefresh}
                        className="bg-blue-600 text-white px-2 sm:px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-xs sm:text-sm"
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Atualizar
                      </button>
                    </div>
                  </div>
                </div>
                <div className="aspect-w-16 aspect-h-9 bg-gray-100 relative">
                  <div 
                    className="absolute inset-0 bg-gradient-to-br from-green-100 via-blue-100 to-green-200 flex items-center justify-center p-2 sm:p-4"
                    style={{ height: '300px', minHeight: '300px' }}
                  >
                    {currentLocation ? (
                      <div className="text-center">
                        {/* Círculos de precisão */}
                        <div className="relative">
                          <div className="absolute -inset-12 bg-red-200 rounded-full opacity-20 animate-ping"></div>
                          <div className="absolute -inset-8 bg-red-300 rounded-full opacity-30 animate-pulse"></div>
                          <div className="absolute -inset-4 bg-red-400 rounded-full opacity-40"></div>
                          
                          {/* Marcador principal */}
                          <div className="w-16 sm:w-20 h-16 sm:h-20 bg-red-500 rounded-full flex items-center justify-center shadow-xl animate-bounce">
                            <MapPin className="w-8 sm:w-10 h-8 sm:h-10 text-white" />
                          </div>
                          
                          {/* Indicador de status */}
                          <div className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2 w-5 sm:w-6 h-5 sm:h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                          </div>
                        </div>
                        
                        {/* Info card */}
                        <div className="bg-white rounded-xl shadow-2xl p-3 sm:p-4 lg:p-6 max-w-xs sm:max-w-sm mt-4 sm:mt-6 border-2 border-red-200 mx-2 sm:mx-4">
                          <p className="font-bold text-gray-900 text-lg sm:text-xl mb-2 sm:mb-3">
                             {session.tracked_user_name}
                          </p>
                          <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3 font-medium break-words">
                            {currentLocation.address}
                          </p>
                          <p className="text-xs text-gray-400 font-mono mb-3 sm:mb-4 bg-gray-50 p-2 rounded break-all">
                            {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs">
                            <div className="bg-red-50 p-1 sm:p-2 lg:p-3 rounded-lg border border-red-200">
                              <span className="text-red-600 font-bold"> Precisão</span><br/>
                              <span className="text-red-800 font-bold">{currentLocation.accuracy.toFixed(1)}m</span>
                            </div>
                            <div className="bg-blue-50 p-1 sm:p-2 lg:p-3 rounded-lg border border-blue-200">
                              <span className="text-blue-600 font-bold">⏰ Horário</span><br/>
                              <span className="text-blue-800 font-bold">{formatTime(parseDate(currentLocation.created_at))}</span>
                            </div>
                          </div>
                          <div className="mt-2 sm:mt-3 lg:mt-4 p-1 sm:p-2 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-green-700 text-xs font-bold text-center">
                              GPS FUNCIONANDO PERFEITAMENTE
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-12 sm:w-16 lg:w-24 h-12 sm:h-16 lg:h-24 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 lg:mb-6 animate-pulse">
                          <Satellite className="w-8 sm:w-12 h-8 sm:h-12 text-gray-500" />
                        </div>
                        <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-500 mb-2">🛰️ Aguardando Sinal GPS...</h3>
                        <p className="text-sm sm:text-base text-gray-400 mb-4">Conectando com o dispositivo</p>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-3 lg:p-4 max-w-xs sm:max-w-sm mx-auto">
                          <p className="text-yellow-700 text-xs sm:text-sm">
                            {session.status === 'pending' 
                              ? '⏳ Aguardando a pessoa aceitar o convite de rastreamento'
                              : session.status === 'inactive'
                              ? 'Inativo Rastreamento está inativo'
                              : '🔍 Buscando primeira localização GPS...'
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Informações Laterais */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Radio className="w-5 h-5 mr-2 text-blue-500" />
                  HIST Status do Rastreamento
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm sm:text-base text-gray-600">Status GPS:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      session.status === 'active' ? 'bg-green-100 text-green-800' : 
                      session.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {session.status === 'active' ? ' ATIVO' : 
                       session.status === 'pending' ? 'Pendente AGUARDANDO' : 'INATIVO'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm sm:text-base text-gray-600">Iniciado em:</span>
                    <span className="text-sm sm:text-base text-gray-900 font-medium">
                      {formatDate(parseDate(session.created_at))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm sm:text-base text-gray-600">Total de Pontos:</span>
                    <span className="text-sm sm:text-base text-gray-900 font-bold">{locations.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm sm:text-base text-gray-600">Última Atualização:</span>
                    <span className="text-sm sm:text-base text-gray-900 font-medium">
                      {formatTime(lastRefresh)}
                    </span>
                  </div>
                </div>
              </div>

              {currentLocation && (
                <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-red-500" />
                     Localização Atual
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-bold text-gray-600"> Endereço:</p>
                      <p className="text-sm sm:text-base text-gray-900 font-medium break-words">{currentLocation.address}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-600"> Status:</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        session.status === 'active' 
                          ? (isOnline ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800')
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {session.status === 'active' 
                          ? (isOnline ? ' GPS AO VIVO' : 'OFFLINE') 
                          : 'INATIVO'
                        }
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-600">Internet: Coordenadas:</p>
                      <p className="text-gray-900 font-mono text-xs sm:text-sm bg-gray-50 p-2 rounded break-all">
                        {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-600"> Precisão GPS:</p>
                      <p className="text-sm sm:text-base text-gray-900 font-bold">{currentLocation.accuracy.toFixed(1)} metros</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-600">⏰ Última Atualização:</p>
                      <p className="text-sm sm:text-base text-gray-900 font-bold">
                        {formatDate(parseDate(currentLocation.created_at))} às {formatTime(parseDate(currentLocation.created_at))}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botão de limpeza */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">Excluir Gerenciar Dados</h3>
                <button
                  onClick={handleClearHistory}
                  className="w-full bg-red-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center font-bold text-sm sm:text-base"
                  disabled={locations.length === 0}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Excluir Limpar Todo Histórico
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Esta ação não pode ser desfeita
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Lista de Localizações */
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 sm:p-3 lg:p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-green-50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm lg:text-lg font-bold text-gray-900">
                  Link Histórico Completo de Localizações ({locations.length} pontos)
                </h3>
                <div className="text-xs sm:text-sm text-gray-500">
                  {locations.length > 0 && (
                    <>📅 Período: {formatDate(parseDate(locations[0].created_at))} - {formatDate(parseDate(locations[locations.length - 1].created_at))}</>
                  )}
                </div>
              </div>
            </div>
            {locations.length === 0 ? (
              <div className="text-center py-8 sm:py-12 lg:py-16 px-2">
                <div className="bg-blue-100 rounded-full p-3 sm:p-4 lg:p-6 w-12 sm:w-16 lg:w-24 h-12 sm:h-16 lg:h-24 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <MapPin className="w-8 sm:w-12 h-8 sm:h-12 text-blue-600" />
                </div>
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 mb-2"> Nenhuma Localização Registrada</h3>
                <p className="text-sm sm:text-base text-gray-500 mb-4">
                  {session.status === 'pending' ? '⏳ Aguardando aceitação do convite de rastreamento' : 
                   session.status === 'inactive' ? 'Inativo O rastreamento não está ativo' :
                   '🔍 Aguardando primeira localização GPS...'}
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-3 lg:p-4 max-w-xs sm:max-w-md mx-auto">
                  <p className="text-yellow-700 text-xs sm:text-sm">
                    💡 As localizações aparecerão aqui assim que o GPS começar a funcionar
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-64 sm:max-h-80 lg:max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-blue-50 sticky top-0">
                    <tr>
                      <th className="px-2 sm:px-3 lg:px-6 py-2 sm:py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        ⏰ Data/Hora
                      </th>
                      <th className="px-2 sm:px-3 lg:px-6 py-2 sm:py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                         Endereço
                      </th>
                      <th className="px-2 sm:px-3 lg:px-6 py-2 sm:py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                        Internet: Coordenadas
                      </th>
                      <th className="px-2 sm:px-3 lg:px-6 py-2 sm:py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                         Precisão
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {locations.slice().reverse().map((location, index) => (
                      <tr key={index} className={`hover:bg-blue-50 transition-colors ${index === 0 ? 'bg-red-50 border-l-4 border-red-500' : ''}`}>
                        <td className="px-2 sm:px-3 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                          <div className="flex items-center">
                            {index === 0 && <div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></div>}
                            <div>
                              <div className="font-bold text-xs">{formatDate(parseDate(location.created_at))}</div>
                              <div className="text-red-600 font-bold text-xs">{formatTime(parseDate(location.created_at))}</div>
                              {index === 0 && <span className="text-xs bg-red-100 text-red-600 px-1 sm:px-2 py-1 rounded-full font-bold"> ATUAL</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 sm:px-3 lg:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-900 font-medium">
                          {location.address}
                        </td>
                        <td className="px-2 sm:px-3 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs font-mono text-gray-900 bg-gray-50 hidden lg:table-cell">
                          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                        </td>
                        <td className="px-2 sm:px-3 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            location.accuracy < 10 ? 'bg-green-100 text-green-800' : 
                            location.accuracy < 20 ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'
                          }`}>
                             {location.accuracy.toFixed(1)}m
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};