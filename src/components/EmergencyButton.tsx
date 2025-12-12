import React, { useState } from 'react';
import { AlertTriangle, Zap, MapPin } from 'lucide-react';
import { useEmergencyAlert } from '../hooks/useEmergencyAlert';

interface EmergencyButtonProps {
  sessionId: string;
  onEmergencyAlert?: (alert: any) => void;
  disabled?: boolean;
}

export const EmergencyButton: React.FC<EmergencyButtonProps> = ({
  sessionId,
  onEmergencyAlert,
  disabled = false
}) => {
  const { sendEmergencyAlert, sending } = useEmergencyAlert();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleEmergencyClick = () => {
    if (disabled || sending) return;
    setShowConfirm(true);
  };

  const confirmEmergency = async () => {
    try {
      console.log('Alerta: Ativando botão de pânico...');
      
      const alert = await sendEmergencyAlert(sessionId, 'Botão de pânico ativado');
      
      if (alert) {
        console.log('Alerta de emergência enviado:', alert);
        onEmergencyAlert?.(alert);
        
        // Feedback visual/sonoro
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }
        
        // Notificação do sistema
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Alerta: Alerta de Emergência Enviado', {
            body: 'Sua localização foi enviada para os responsáveis',
            icon: '/emergency-icon.png'
          });
        }
      }
      
      setShowConfirm(false);
    } catch (error) {
      console.error('Erro ao enviar alerta:', error);
      alert('Erro ao enviar alerta de emergência. Tente novamente.');
      setShowConfirm(false);
    }
  };

  const cancelEmergency = () => {
    setShowConfirm(false);
  };

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 text-center">
          <div className="bg-red-100 rounded-full p-4 w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-red-600 animate-pulse" />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Alerta: Confirmar Emergência
          </h3>
          
          <p className="text-gray-600 mb-6 text-sm">
            Isso enviará sua localização atual para todos os responsáveis imediatamente.
          </p>
          
          <div className="flex space-x-3">
            <button
              onClick={cancelEmergency}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={confirmEmergency}
              disabled={sending}
              className={`flex-1 px-4 py-3 rounded-lg font-bold text-white transition-colors ${
                sending
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 animate-pulse'
              }`}
            >
              {sending ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Enviando...
                </div>
              ) : (
                <>
                  <Zap className="w-4 h-4 inline mr-2" />
                  Alerta: CONFIRMAR
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleEmergencyClick}
      disabled={disabled || sending}
      className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 ${
        disabled || sending
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-lg hover:shadow-xl transform hover:scale-105 animate-pulse'
      }`}
      style={{
        background: disabled || sending 
          ? undefined 
          : 'linear-gradient(45deg, #dc2626, #ef4444, #dc2626)',
        backgroundSize: '200% 200%',
        animation: disabled || sending ? undefined : 'gradient 2s ease infinite, pulse 2s infinite'
      }}
    >
      <div className="flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 mr-3" />
        {sending ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            ENVIANDO...
          </>
        ) : (
          'Alerta: BOTÃO DE PÂNICO'
        )}
      </div>
      
      {!disabled && !sending && (
        <div className="text-sm mt-1 opacity-90">
          <MapPin className="w-4 h-4 inline mr-1" />
          Toque para enviar sua localização
        </div>
      )}
    </button>
  );
};