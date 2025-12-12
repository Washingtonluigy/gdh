import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  ArrowLeft, 
  MapPin, 
  Navigation, 
  RefreshCw, 
  Target, 
  Zap,
  AlertTriangle,
  Clock,
  Activity,
  Satellite,
  Radio,
  Shield,
  Plus
} from 'lucide-react';
import { TrackingSession, Location } from '../types';

// Mapbox access token with fallback
const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidmlnaWFsaW5rIiwiYSI6ImNtZ3IzcDF1NjJldmoybHB4dnR1bGU2d3AifQ.HAJrAG4J7srrjRFYMGAF9g';
mapboxgl.accessToken = mapboxToken;

interface GPSMapTrackerProps {
  session: TrackingSession;
  locations: Location[];
  onBack: () => void;
  onRefresh?: () => void;
  isOnline?: boolean;
  onLocationUpdate?: (location: Location) => void;
  onNotification?: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => void;
}

export const GPSMapTracker: React.FC<GPSMapTrackerProps> = ({
  session,
  locations = [],
  onBack,
  onRefresh,
  isOnline = true,
  onLocationUpdate,
  onNotification
}) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [watchId, setWatchId] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'inactive' | 'searching' | 'active' | 'error'>('inactive');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Safely get the most recent location
  const latestLocation = locations && locations.length > 0 ? locations[locations.length - 1] : null;

  // Safe notification function
  const safeNotify = useCallback((type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => {
    try {
      if (onNotification && title && message) {
        onNotification(type, title, message);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, [onNotification]);

  // Safe refresh function
  const safeRefresh = useCallback(() => {
    try {
      if (onRefresh && typeof onRefresh === 'function') {
        onRefresh();
      }
    } catch (error) {
      console.error('Error during refresh:', error);
      safeNotify('error', 'Erro', 'Falha ao atualizar dados');
    }
  }, [onRefresh, safeNotify]);

  // Update position with safety checks
  const handleUpdatePosition = useCallback(async () => {
    if (isUpdating) {
      console.log('Update already in progress');
      return;
    }

    try {
      setIsUpdating(true);
      setGpsStatus('searching');
      
      console.log(' Starting position update...');
      
      // Clear any existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Set timeout to prevent infinite loading
      updateTimeoutRef.current = setTimeout(() => {
        setIsUpdating(false);
        setGpsStatus('error');
        safeNotify('warning', 'GPS Timeout', 'Não foi possível obter localização em tempo hábil');
      }, 10000);

      if (!navigator.geolocation) {
        throw new Error('Geolocalização não suportada');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0
          }
        );
      });

      // Clear timeout on success
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }

      const { coords } = position;
      const newLocation: Location = {
        id: `loc_${Date.now()}`,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || 0,
        altitude: coords.altitude,
        heading: coords.heading,
        speed: coords.speed,
        created_at: new Date().toISOString(),
        address: `GPS: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
      };

      setCurrentLocation(newLocation);
      setLastUpdate(new Date());
      setGpsStatus('active');
      
      console.log('Position updated:', newLocation);
      safeNotify('success', 'GPS Atualizado', `Localização obtida com precisão de ${coords.accuracy?.toFixed(1)}m`);
      
      // Notify parent component
      if (onLocationUpdate) {
        onLocationUpdate(newLocation);
      }

      // Refresh data
      safeRefresh();

    } catch (error) {
      console.error('Error updating position:', error);
      setGpsStatus('error');
      
      const errorMessage = error instanceof GeolocationPositionError 
        ? getGeolocationErrorMessage(error.code)
        : 'Erro desconhecido ao obter localização';
        
      safeNotify('error', 'Erro GPS', errorMessage);
    } finally {
      setIsUpdating(false);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    }
  }, [isUpdating, onLocationUpdate, safeRefresh, safeNotify]);

  // Get geolocation error message
  const getGeolocationErrorMessage = (code: number): string => {
    switch (code) {
      case 1: return 'Permissão de localização negada';
      case 2: return 'Localização indisponível';
      case 3: return 'Timeout na obtenção da localização';
      default: return 'Erro desconhecido de GPS';
    }
  };

  // Start continuous tracking
  const startTracking = useCallback(() => {
    if (isTracking || !navigator.geolocation) {
      return;
    }

    console.log('🛰️ Starting GPS tracking...');
    setIsTracking(true);
    setGpsStatus('searching');

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { coords } = position;
        const newLocation: Location = {
          id: `loc_${Date.now()}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy || 0,
          altitude: coords.altitude,
          heading: coords.heading,
          speed: coords.speed,
          created_at: new Date().toISOString(),
          address: `GPS: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
        };

        setCurrentLocation(newLocation);
        setLastUpdate(new Date());
        setGpsStatus('active');
        
        if (onLocationUpdate) {
          onLocationUpdate(newLocation);
        }
      },
      (error) => {
        console.error('GPS tracking error:', error);
        setGpsStatus('error');
        safeNotify('warning', 'GPS', getGeolocationErrorMessage(error.code));
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 5000
      }
    );

    setWatchId(id);
    console.log('GPS tracking started with ID:', id);
  }, [isTracking, onLocationUpdate, safeNotify]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      console.log('Parar GPS tracking stopped');
    }
    setIsTracking(false);
    setGpsStatus('inactive');
  }, [watchId]);

  // Center on person
  const handleCenterOnPerson = useCallback(() => {
    const locationToCenter = currentLocation || latestLocation;
    if (!locationToCenter) {
      safeNotify('warning', 'Localização', 'Nenhuma localização disponível para centralizar');
      return;
    }

    console.log(' Centering on person:', locationToCenter);
    safeNotify('info', 'Mapa', `Centralizado em: ${locationToCenter.address}`);
  }, [currentLocation, latestLocation, safeNotify]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [watchId]);

  // Auto-start tracking if session is active
  useEffect(() => {
    if (session?.status === 'active' && !isTracking && navigator.geolocation) {
      const timer = setTimeout(() => {
        startTracking();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [session?.status, isTracking, startTracking]);

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Get status color
  const getStatusColor = () => {
    switch (gpsStatus) {
      case 'active': return 'text-green-600';
      case 'searching': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (gpsStatus) {
      case 'active': return 'ATIVO GPS ATIVO';
      case 'searching': return 'Pendente LOCALIZANDO...';
      case 'error': return ' ERRO GPS';
      default: return 'Inativo GPS INATIVO';
    }
  };

  const displayLocation = currentLocation || latestLocation;

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapRef.current) return;

    try {
      console.log('MAPA Initializing Mapbox map...');
      
      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-46.633309, -23.550520], // São Paulo
        zoom: 13,
        attributionControl: false
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      map.on('load', () => {
        console.log('Mapbox map loaded successfully');
      });

      map.on('error', (e) => {
        console.error('Mapbox error:', e);
      });

      mapInstanceRef.current = map;

      // Cleanup function for this effect
      return () => {
        console.log('🧹 Cleaning up Mapbox map...');
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };

    } catch (error) {
      console.error('Error initializing map:', error);
      safeNotify('error', 'Erro do Mapa', 'Falha ao carregar o mapa');
    }
  }, []); // Empty dependency array - initialize once on mount

  // Update map with location
  useEffect(() => {
    if (!mapInstanceRef.current || !displayLocation) return;

    try {
      const { latitude, longitude } = displayLocation;
      console.log(' Updating map with location:', { latitude, longitude });

      // Remove existing marker
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // Create new marker
      const marker = new mapboxgl.Marker({
        color: '#ef4444',
        scale: 1.2
      })
        .setLngLat([longitude, latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="p-2">
                <h3 class="font-bold text-gray-900">${session?.tracked_user_name || 'Usuário'}</h3>
                <p class="text-sm text-gray-600">${displayLocation.address}</p>
                <p class="text-xs text-gray-400 font-mono">${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
                <p class="text-xs text-green-600 font-medium mt-1">Precisão: ${displayLocation.accuracy.toFixed(1)}m</p>
              </div>
            `)
        )
        .addTo(mapInstanceRef.current);

      markerRef.current = marker;

      // Center map on location
      mapInstanceRef.current.flyTo({
        center: [longitude, latitude],
        zoom: 16,
        duration: 1000
      });

    } catch (error) {
      console.error('Error updating map:', error);
    }
  }, [displayLocation, session?.tracked_user_name]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={onBack}
                type="button"
                className="mr-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center">
                <MapPin className="w-6 h-6 mr-2" />
                <div>
                  <h1 className="text-lg font-bold"> {session?.tracked_user_name || 'Usuário'}</h1>
                  <p className="text-sm text-blue-100">
                    {session?.tracked_user_phone} • {getStatusText()}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center text-sm font-medium ${getStatusColor()}`}>
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  gpsStatus === 'active' ? 'bg-green-400 animate-pulse' :
                  gpsStatus === 'searching' ? 'bg-yellow-400 animate-pulse' :
                  gpsStatus === 'error' ? 'bg-red-400' : 'bg-gray-400'
                }`}></div>
                {getStatusText()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Map Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-green-50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <Satellite className="w-5 h-5 mr-2 text-blue-500" />
                    MAPA Localização de{' '}
                    <span className="ml-1 text-blue-600">{session?.tracked_user_name}</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className={`flex items-center text-sm font-bold ${getStatusColor()}`}>
                      <Radio className="w-4 h-4 mr-1" />
                      {gpsStatus === 'searching' ? '🔍 LOCALIZANDO...' : getStatusText()}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Map Container */}
              <div 
                ref={mapRef}
                className="relative"
                style={{ height: '500px' }}
              >
                {!displayLocation && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Satellite className="w-12 h-12 text-gray-500" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-500 mb-2">
                        {gpsStatus === 'searching' ? '🔍 Localizando...' : '🛰️ Aguardando GPS...'}
                      </h3>
                      <p className="text-gray-400 mb-4">
                        {gpsStatus === 'searching' ? 'Obtendo localização atual' : 'Conectando com o dispositivo'}
                      </p>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-sm mx-auto">
                        <p className="text-yellow-700 text-sm">
                          {session?.status === 'pending' 
                            ? '⏳ Aguardando aceitação do convite'
                            : session?.status === 'inactive'
                            ? 'Inativo Rastreamento inativo'
                            : '🔍 Buscando primeira localização GPS...'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="space-y-6">
            {/* GPS Controls */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Navigation className="w-5 h-5 mr-2 text-blue-500" />
                🛰️ Controles GPS
              </h3>
              <div className="space-y-3">
                <button
                  onClick={handleUpdatePosition}
                  disabled={isUpdating}
                  type="button"
                  className={`w-full flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-colors ${
                    isUpdating
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      🔍 Atualizando...
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4 mr-2" />
                       Atualizar Posição
                    </>
                  )}
                </button>

                <button
                  onClick={handleCenterOnPerson}
                  disabled={!displayLocation}
                  type="button"
                  className={`w-full flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-colors ${
                    displayLocation
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                   Centralizar Pessoa
                </button>

                {!isTracking ? (
                  <button
                    onClick={startTracking}
                    type="button"
                    className="w-full flex items-center justify-center py-3 px-4 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Iniciar Rastreamento
                  </button>
                ) : (
                  <button
                    onClick={stopTracking}
                    type="button"
                    className="w-full flex items-center justify-center py-3 px-4 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Parar Parar Rastreamento
                  </button>
                )}
              </div>
            </div>

            {/* Status Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-green-500" />
                HIST Status do Sistema
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status GPS:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    gpsStatus === 'active' ? 'bg-green-100 text-green-800' :
                    gpsStatus === 'searching' ? 'bg-yellow-100 text-yellow-800' :
                    gpsStatus === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getStatusText()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rastreamento:</span>
                  <span className={`font-medium ${isTracking ? 'text-green-600' : 'text-gray-600'}`}>
                    {isTracking ? 'ATIVO' : 'INATIVO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Última Atualização:</span>
                  <span className="text-gray-900 font-medium">
                    {formatTime(lastUpdate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de Pontos:</span>
                  <span className="text-gray-900 font-bold">{locations.length}</span>
                </div>
              </div>
            </div>

            {/* Location Details */}
            {displayLocation && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-red-500" />
                   Localização Atual
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Endereço:</p>
                    <p className="text-gray-900 font-medium">{displayLocation.address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Latitude:</p>
                      <p className="text-gray-900 font-mono text-sm">{displayLocation.latitude.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Longitude:</p>
                      <p className="text-gray-900 font-mono text-sm">{displayLocation.longitude.toFixed(6)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Precisão:</p>
                      <p className="text-gray-900 font-bold">{displayLocation.accuracy.toFixed(1)}m</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Horário:</p>
                      <p className="text-gray-900 font-bold">
                        {formatTime(new Date(displayLocation.created_at))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Zones Placeholder */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-blue-500" />
                🛡️ Zonas de Segurança
              </h3>
              <div className="text-center py-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <AlertTriangle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-yellow-800 text-sm font-medium">GPS Inativo</p>
                  <p className="text-yellow-700 text-xs mt-1">
                    Ative o rastreamento para criar zonas
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};