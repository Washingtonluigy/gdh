import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Shield, MapPin, Clock, User, CheckCircle, XCircle, AlertTriangle, Loader, Mail, UserPlus } from 'lucide-react';

interface ConsentPageProps {
  inviteToken: string | null;
  invite: any;
  loading: boolean;
  error: string | null;
  onAccept: () => void;
  onReject: () => void;
  onNavigateToLogin?: () => void;
  onNavigateToRegister?: () => void;
}

export const ConsentPage: React.FC<ConsentPageProps> = ({ 
  inviteToken, 
  invite, 
  loading, 
  error, 
  onAccept, 
  onReject,
  onNavigateToLogin,
  onNavigateToRegister
}) => {
  console.log('📄 ConsentPage renderizada:', { inviteToken, invite, loading, error });

  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [acceptedData, setAcceptedData] = useState(false);
  const [acceptedLocation, setAcceptedLocation] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Carregando convite...</h1>
          <p className="text-gray-600">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="bg-red-100 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Convite Inválido</h1>
          <p className="text-gray-600 mb-6">
            {error || 'Este convite não existe ou já expirou. Certifique-se de que você está usando o link correto.'}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  const canAccept = hasReadTerms && acceptedData && acceptedLocation && !isAccepting;

  const handleAccept = async () => {
    if (!canAccept) {
      alert('Por favor, aceite todos os termos antes de continuar.');
      return;
    }
    
    setIsAccepting(true);
    setAcceptError(null);
    try {
      console.log(' Iniciando processo de aceitação...');
      
      // Now accept the invite
      await onAccept();
      console.log('Processo de aceitação concluído');
    } catch (error) {
      console.error('Error accepting tracking:', error);
      setAcceptError(error instanceof Error ? error.message : 'Erro desconhecido ao aceitar rastreamento');
      setIsAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 xl:p-8 max-w-2xl w-full mx-2 sm:mx-4 max-h-[95vh] overflow-y-auto">
        <div className="text-center mb-8">
          <div className="bg-blue-100 rounded-full p-3 sm:p-4 w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mx-auto mb-4">
            <img 
              src="/a-modern-logo-design-featuring-a-stylize_V-pwcN2yQoKBSk9UUsAm6A_zcNnTwtaQniaKzNe0_Zg4g.png" 
              alt="VigiaLink Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Solicitação de Proteção</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Você foi convidado(a) para ativar a proteção familiar
          </p>
        </div>

        {/* Informações do Solicitante */}
        <div className="bg-blue-50 rounded-lg p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-3 flex items-center">
            <User className="w-5 h-5 mr-2" />
            Informações da Proteção
          </h3>
          <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm lg:text-base">
            <p className="text-blue-800 break-words">
              <strong>Solicitante:</strong> {invite?.admin_name || 'Administrador'}
            </p>
            <p className="text-blue-800 break-words">
              <strong>Para:</strong> {invite?.tracked_user_name || 'Usuário'}
            </p>
            <p className="text-blue-800">
              <strong>Data da Solicitação:</strong> {invite?.created_at ? new Date(invite.created_at).toLocaleDateString('pt-BR') : '--'}
            </p>
            <p className="text-blue-800">
              <strong>Válido até:</strong> {invite?.expires_at ? new Date(invite.expires_at).toLocaleDateString('pt-BR') : '--'}
            </p>
          </div>
        </div>

        {/* Informações sobre o Rastreamento */}
        <div className="bg-yellow-50 rounded-lg p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-yellow-900 mb-3 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Como Funciona a Proteção
          </h3>
          <div className="space-y-2 sm:space-y-3 text-yellow-800 text-xs sm:text-sm lg:text-base">
            <div className="flex items-start">
              <MapPin className="w-5 h-5 mr-2 mt-1 text-yellow-600" />
              <div>
                <p className="font-medium">Localização GPS Real</p>
                <p className="text-xs sm:text-sm">Sua localização será monitorada para garantir sua segurança</p>
              </div>
            </div>
            <div className="flex items-start">
              <Clock className="w-5 h-5 mr-2 mt-1 text-yellow-600" />
              <div>
                <p className="font-medium">Atualizações Automáticas</p>
                <p className="text-xs sm:text-sm">Sistema de proteção ativo 24/7 com atualizações em tempo real</p>
              </div>
            </div>
            <div className="flex items-start">
              <Shield className="w-5 h-5 mr-2 mt-1 text-yellow-600" />
              <div>
                <p className="font-medium">Dados Seguros</p>
               <p className="text-xs sm:text-sm">Máxima segurança e privacidade dos seus dados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Termos e Condições */}
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
            Termos de Consentimento LGPD
          </h3>
          <div className="max-h-24 sm:max-h-32 lg:max-h-48 overflow-y-auto text-xs sm:text-sm text-gray-700 space-y-1 sm:space-y-2">
            <p>
              <strong>1. Finalidade:</strong> O tratamento de dados de localização tem como finalidade 
              exclusiva permitir o acompanhamento da sua localização por familiares autorizados.
            </p>
            <p>
              <strong>2. Base Legal:</strong> O tratamento é realizado com base no seu consentimento 
              expresso e específico, conforme Art. 7º, I da LGPD.
            </p>
            <p>
              <strong>3. Dados Coletados:</strong> Serão coletados dados de geolocalização (latitude, 
              longitude, precisão, altitude, velocidade) e timestamps.
            </p>
            <p>
              <strong>4. Compartilhamento:</strong> Seus dados serão compartilhados apenas com a 
              pessoa que solicitou o rastreamento.
            </p>
            <p>
              <strong>5. Armazenamento:</strong> Os dados serão armazenados de forma segura e 
              criptografada em servidores seguros (Supabase/PostgreSQL).
            </p>
            <p>
              <strong>6. Seus Direitos:</strong> Você pode a qualquer momento revogar este 
              consentimento, solicitar a exclusão dos dados ou exercer outros direitos previstos na LGPD.
            </p>
            <p>
              <strong>7. Prazo:</strong> Os dados serão mantidos enquanto houver consentimento 
              ativo ou conforme exigido por lei.
            </p>
          </div>
        </div>

        {/* Checkboxes de Consentimento */}
        <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={hasReadTerms}
              onChange={(e) => setHasReadTerms(e.target.checked)}
              className="mt-0.5 sm:mt-1 h-4 w-4 sm:h-5 sm:w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-xs sm:text-sm lg:text-base text-gray-700">
              Eu li e compreendi todos os termos e condições acima
            </span>
          </label>

          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={acceptedData}
              onChange={(e) => setAcceptedData(e.target.checked)}
              className="mt-0.5 sm:mt-1 h-4 w-4 sm:h-5 sm:w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-xs sm:text-sm lg:text-base text-gray-700">
              Eu autorizo o tratamento dos meus dados de localização conforme descrito
            </span>
          </label>

          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={acceptedLocation}
              onChange={(e) => setAcceptedLocation(e.target.checked)}
              className="mt-0.5 sm:mt-1 h-4 w-4 sm:h-5 sm:w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-xs sm:text-sm lg:text-base text-gray-700">
              Eu concordo em ativar o sistema de proteção familiar
            </span>
          </label>
        </div>

        {/* Error Display */}
        {acceptError && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800 font-medium text-sm sm:text-base">Erro ao aceitar rastreamento</p>
            </div>
            <p className="text-red-700 mt-1 text-xs sm:text-sm">{acceptError}</p>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 lg:space-x-4">
          <button
            onClick={onReject}
            disabled={isAccepting}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center disabled:opacity-50 text-sm sm:text-base"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Rejeitar
          </button>
          <button
            onClick={handleAccept}
            disabled={!canAccept}
            className={`w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-colors flex items-center justify-center text-sm sm:text-base ${
              canAccept
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isAccepting ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                <span className="hidden sm:inline">Iniciando...</span>
                <span className="sm:hidden">Iniciando</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{canAccept ? 'Aceitar e Ativar Proteção' : 'Complete todos os campos acima'}</span>
                <span className="sm:hidden">{canAccept ? 'Aceitar' : 'Complete'}</span>
              </>
            )}
          </button>
        </div>

        {/* Informação sobre autenticação */}
        <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-blue-800 text-xs sm:text-sm text-center">
            ℹ️ Não é necessário criar conta ou fazer login. O rastreamento funciona de forma anônima e segura.
          </p>
        </div>

        {/* Informação sobre o processo */}
        <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-blue-800 text-xs sm:text-sm text-center">
            Após aceitar, você será rastreado(a) automaticamente. Apenas a pessoa que te convidou terá acesso à sua localização.
          </p>
        </div>

        {/* Informação sobre GPS */}
        <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-green-800 text-xs sm:text-sm text-center">
            <span className="hidden sm:inline"> O navegador solicitará permissão para acessar sua localização. Clique em "Permitir" para ativar a proteção. Funciona mesmo sem internet!</span>
            <span className="sm:hidden"> Permita acesso à localização quando solicitado. Funciona offline!</span>
          </p>
        </div>
      </div>
    </div>
  );
};