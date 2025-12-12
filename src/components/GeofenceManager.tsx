import React, { useState } from 'react';
import { MapPin, Plus, Trash2, Shield, AlertTriangle, Home, School } from 'lucide-react';
import { useGeofencing, GeofenceZone } from '../hooks/useGeofencing';

interface GeofenceManagerProps {
  sessionId: string;
  currentLocation?: { latitude: number; longitude: number };
  onGeofenceAlert?: (alert: any) => void;
}

export const GeofenceManager: React.FC<GeofenceManagerProps> = ({
  sessionId,
  currentLocation,
  onGeofenceAlert
}) => {
  const { zones, loading, createZone, deleteZone } = useGeofencing(sessionId, onGeofenceAlert);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'safe' as 'safe' | 'restricted',
    radius: 100
  });

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentLocation) {
      alert('Localização atual não disponível. Ative o GPS primeiro.');
      return;
    }

    if (!formData.name.trim()) {
      alert('Nome da zona é obrigatório');
      return;
    }

    try {
      await createZone({
        session_id: sessionId,
        name: formData.name,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radius: formData.radius,
        type: formData.type,
        active: true
      });

      setFormData({ name: '', type: 'safe', radius: 100 });
      setShowCreateForm(false);
      
      console.log('Zona criada com sucesso');
    } catch (error) {
      console.error('Erro ao criar zona:', error);
      alert('Erro ao criar zona. Tente novamente.');
    }
  };

  const handleDeleteZone = async (zoneId: string, zoneName: string) => {
    if (confirm(`Excluir Tem certeza que deseja excluir a zona "${zoneName}"?`)) {
      try {
        await deleteZone(zoneId);
        console.log('Zona excluída:', zoneName);
      } catch (error) {
        console.error('Erro ao excluir zona:', error);
        alert('Erro ao excluir zona. Tente novamente.');
      }
    }
  };

  const getZoneIcon = (type: string) => {
    switch (type) {
      case 'safe': return <Shield className="w-4 h-4 text-green-600" />;
      case 'restricted': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <MapPin className="w-4 h-4 text-blue-600" />;
    }
  };

  const getZoneColor = (type: string) => {
    switch (type) {
      case 'safe': return 'bg-green-50 border-green-200 text-green-800';
      case 'restricted': return 'bg-red-50 border-red-200 text-red-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const quickZones = [
    { name: '🏠 Casa', type: 'safe' as const, radius: 50 },
    { name: '🏫 Escola', type: 'safe' as const, radius: 100 },
    { name: '👵 Casa da Vovó', type: 'safe' as const, radius: 50 },
    { name: '🏥 Hospital', type: 'safe' as const, radius: 200 }
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center">
          <MapPin className="w-5 h-5 mr-2 text-blue-500" />
          🛡️ Zonas de Segurança
        </h3>
        <button
          onClick={() => setShowCreateForm(true)}
          disabled={!currentLocation}
          className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
            currentLocation
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={!currentLocation ? 'Ative o GPS para criar zonas' : 'Criar nova zona'}
        >
          <Plus className="w-4 h-4 mr-1 inline" />
          Nova Zona
        </button>
      </div>

      {/* Status da localização */}
      <div className={`p-3 rounded-lg mb-4 text-sm ${
        currentLocation 
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
      }`}>
        <div className="flex items-center">
          <MapPin className="w-4 h-4 mr-2" />
          {currentLocation 
            ? ` GPS Ativo - Localização: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
            : 'GPS Inativo - Ative o rastreamento para criar zonas'
          }
        </div>
      </div>

      {/* Lista de zonas */}
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Carregando zonas...</p>
        </div>
      ) : zones.length === 0 ? (
        <div className="text-center py-8">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Nenhuma zona de segurança criada</p>
          <p className="text-sm text-gray-400">
            Crie zonas para receber alertas quando entrar ou sair de locais importantes
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className={`p-4 rounded-lg border ${getZoneColor(zone.type)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {getZoneIcon(zone.type)}
                  <div className="ml-3">
                    <h4 className="font-medium">{zone.name}</h4>
                    <p className="text-sm opacity-75">
                      {zone.type === 'safe' ? '🛡️ Zona Segura' : 'Zona Restrita'} • 
                      Raio: {zone.radius}m
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteZone(zone.id, zone.name)}
                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  title="Excluir zona"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              🛡️ Criar Zona de Segurança
            </h3>

            {/* Zonas rápidas */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Zonas Rápidas:</p>
              <div className="grid grid-cols-2 gap-2">
                {quickZones.map((quick, index) => (
                  <button
                    key={index}
                    onClick={() => setFormData({
                      name: quick.name,
                      type: quick.type,
                      radius: quick.radius
                    })}
                    className="p-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    {quick.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateZone} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Zona
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Casa, Escola, Trabalho"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Zona
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'safe' | 'restricted' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="safe">🛡️ Zona Segura (alerta ao sair)</option>
                  <option value="restricted">Zona Restrita (alerta ao entrar)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raio da Zona (metros)
                </label>
                <input
                  type="number"
                  value={formData.radius}
                  onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) || 100 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="10"
                  max="1000"
                  step="10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Distância em metros para ativar o alerta
                </p>
              </div>

              {currentLocation && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Zona será criada na sua localização atual
                  </p>
                  <p className="text-xs text-blue-600 font-mono">
                    {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  </p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Criar Zona
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};