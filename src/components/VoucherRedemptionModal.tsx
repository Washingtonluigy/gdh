import React, { useState } from 'react';
import { Ticket, CheckCircle, XCircle, Loader } from 'lucide-react';
import { trackingAPI } from '../lib/supabase';

interface VoucherRedemptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentSessions: number;
  allowedSessions: number;
}

export const VoucherRedemptionModal: React.FC<VoucherRedemptionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentSessions,
  allowedSessions
}) => {
  const [voucherCode, setVoucherCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!voucherCode.trim()) {
      setError('Por favor, digite o código do voucher');
      return;
    }

    try {
      setIsRedeeming(true);
      setError(null);
      setSuccess(null);

      const result = await trackingAPI.redeemVoucher(voucherCode.trim());
      
      if (result.success) {
        setSuccess(result.message);
        setVoucherCode('');
        
        // Wait a bit to show success message, then close and refresh
        setTimeout(() => {
          onSuccess();
          setSuccess(null);
          onClose();
        }, 2000);
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error('Error redeeming voucher:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido ao resgatar voucher');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleClose = () => {
    if (!isRedeeming) {
      setVoucherCode('');
      setError(null);
      setSuccess(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-sm w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Ticket className="w-5 h-5 mr-2 text-blue-600" />
              Adicionar Rastreamento
            </h3>
            <button
              onClick={handleClose}
              disabled={isRedeeming}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {/* Current Status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <h4 className="font-medium text-blue-900 mb-1 text-sm">Status Atual</h4>
            <div className="text-sm text-blue-800">
              <p className="text-xs">Ativos: <span className="font-bold">{currentSessions}</span> | Permitidos: <span className="font-bold">{allowedSessions}</span></p>
              <p className="mt-1 font-medium text-xs">
                {currentSessions >= allowedSessions 
                  ? 'Limite atingido'
                  : `Pode criar mais ${allowedSessions - currentSessions}`
                }
              </p>
            </div>
          </div>


          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <h4 className="text-base font-bold text-green-900 mb-1">Sucesso!</h4>
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          ) : (
            <form onSubmit={handleRedeem} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código do Voucher
                </label>
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => {
                    setVoucherCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-center"
                  placeholder="Digite o código"
                  disabled={isRedeeming}
                  maxLength={8}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Código de 8 caracteres
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                  <div className="flex items-center">
                    <XCircle className="w-5 h-5 text-red-600 mr-2" />
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <div className="flex space-x-2 pt-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isRedeeming}
                  className="flex-1 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isRedeeming || !voucherCode.trim()}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                    isRedeeming || !voucherCode.trim()
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isRedeeming ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin inline" />
                      Resgatando...
                    </>
                  ) : (
                    'Resgatar Voucher'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Help Text */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-1 text-sm">💡 Como funciona?</h4>
            <div className="text-xs text-yellow-800 space-y-0.5">
              <p>• Voucher = +1 rastreamento (R$ 9,90)</p>
              <p>• Digite o código recebido</p>
              <p>• Limite aumenta automaticamente</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};