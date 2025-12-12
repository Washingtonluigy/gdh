import React, { useState } from 'react';
import { 
  Shield, 
  Plus, 
  MapPin, 
  Users, 
  Link, 
  Clock, 
  CheckCircle, 
  XCircle,
  LogOut,
  Copy,
  User,
  Satellite,
  Navigation,
  Activity,
  Eye,
  Trash2,
  Zap,
  Radio,
  Map,
  RefreshCw,
  HelpCircle,
  MessageCircle,
  Phone,
  ExternalLink
} from 'lucide-react';
import { TrackingSession } from '../types';
import { Profile } from '../lib/supabase';
import { VoucherRedemptionModal } from './VoucherRedemptionModal';

interface DashboardProps {
  user: Profile | null;
  trackingSessions: TrackingSession[];
  onCreateSession: (name: string, phone: string) => Promise<TrackingSession>;
  onLogout: () => void;
  onSelectSession: (session: TrackingSession) => void;
  onStopTracking?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onStartGPSTracking?: (session: TrackingSession) => void;
  onStartGPSMap?: (session: TrackingSession) => void;
  isOnline?: boolean;
  onForceRefresh?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  trackingSessions,
  onCreateSession,
  onLogout,
  onSelectSession,
  onStopTracking,
  onDeleteSession,
  onStartGPSTracking,
  onStartGPSMap,
  isOnline = true,
  onForceRefresh,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showFloatingHelp, setShowFloatingHelp] = useState(false);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Nome é obrigatório');
      return;
    }
    
    if (isCreating) return;
    
    try {
      setIsCreating(true);
      console.log('Criando sessão:', formData);
      const session = await onCreateSession(formData.name, formData.phone);
      console.log('Sessão criada:', session);
      setShowCreateModal(false);
      setFormData({ name: '', phone: '' });
      
      // Mostrar o link de convite
      if (session && session.invite_token) {
        const inviteLink = session.invite_link || `${window.location.origin}?token=${session.invite_token}`;
        
        console.log('Link de convite criado:', inviteLink);
        
        // Copiar link automaticamente para área de transferência
        if (navigator.clipboard) {
          navigator.clipboard.writeText(inviteLink).then(() => {
            console.log('Link copiado para área de transferência');
            alert(`SISTEMA DE RASTREAMENTO CRIADO!\n\nLink: ${inviteLink}\n\nEnvie este link para ${formData.name}\n\nFunciona em qualquer lugar do mundo!\n\nAssim que a pessoa aceitar, o GPS será ativado automaticamente!`);
          }).catch(() => {
            console.warn('Falha ao copiar para área de transferência');
            alert(`SISTEMA DE RASTREAMENTO CRIADO!\n\nLink: ${inviteLink}\n\nEnvie este link para ${formData.name}\n\nFunciona em qualquer lugar do mundo!\n\nAssim que a pessoa aceitar, o GPS será ativado automaticamente!`);
          });
        } else {
          console.warn('Clipboard API não disponível');
          alert(`SISTEMA DE RASTREAMENTO CRIADO!\n\nLink: ${inviteLink}\n\nEnvie este link para ${formData.name}\n\nFunciona em qualquer lugar do mundo!\n\nAssim que a pessoa aceitar, o GPS será ativado automaticamente!`);
        }
      } else {
        console.error('Session created but no invite token:', session);
        alert('Sessão criada mas houve problema com o link. Tente criar novamente.');
      }
    } catch (error) {
      console.error('Error creating session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Check if it's a limit error
      if (errorMessage.includes('Limite de rastreamentos atingido')) {
        alert(errorMessage);
        setShowCreateModal(false);
        setShowVoucherModal(true);
      } else {
        alert(`Erro ao criar sessão: ${errorMessage}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = (link: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        console.log('Link copiado:', link);
        alert('Link copiado!\n\nEnvie para a pessoa que você quer proteger.\n\nO rastreamento GPS será ativado automaticamente quando ela aceitar!');
      }).catch((error) => {
        console.error('Erro ao copiar link:', error);
        alert(`Link de rastreamento:\n\n${link}\n\nCopie manualmente e envie para a pessoa que você quer proteger.`);
      });
    } else {
      console.warn('Clipboard API não disponível');
      alert(`Link de rastreamento:\n\n${link}\n\nCopie manualmente e envie para a pessoa que você quer proteger.`);
    }
  };

  const handleStopTracking = (sessionId: string) => {
    if (confirm('Tem certeza que deseja PARAR o rastreamento?\n\nIsso interromperá a coleta de localização GPS.\n\nA pessoa não será mais rastreada.')) {
      onStopTracking?.(sessionId);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    if (confirm('Tem certeza que deseja EXCLUIR este rastreamento?\n\nTodos os dados de localização serão perdidos PERMANENTEMENTE.\n\nEsta ação NÃO pode ser desfeita!')) {
      onDeleteSession?.(sessionId);
    }
  };

  const handleRefresh = () => {
    setLastRefresh(new Date());
    console.log('Refresh manual do dashboard');
    onForceRefresh?.();
  };

  const openWhatsApp = () => {
    const phoneNumber = '5566992068545'; // +55 66 99206-8545
    const message = encodeURIComponent('Olá! Preciso de ajuda com o VigiaLink - Sistema de Rastreamento GPS');
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      case 'inactive': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'ATIVO - GPS FUNCIONANDO';
      case 'pending': return 'AGUARDANDO ACEITAÇÃO';
      case 'rejected': return 'REJEITADO';
      case 'inactive': return 'INATIVO';
      default: return 'INATIVO';
    }
  };

  const activeSessions = trackingSessions.filter(s => s.status === 'active');
  const pendingSessions = trackingSessions.filter(s => s.status === 'pending');
  const currentSessions = activeSessions.length + pendingSessions.length;
  const allowedSessions = user?.allowed_sessions || 2;
  const canCreateMore = currentSessions < allowedSessions;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 sm:py-0 sm:h-16 space-y-2 sm:space-y-0">
            <div className="flex items-center">
              <img 
                src="/a-modern-logo-design-featuring-a-stylize_V-pwcN2yQoKBSk9UUsAm6A_zcNnTwtaQniaKzNe0_Zg4g.png" 
                alt="VigiaLink Logo" 
                className="w-12 h-12 sm:w-20 sm:h-20 lg:w-24 lg:h-24 object-contain mr-2 sm:mr-4"
              />
              <div>
                <h1 className="text-sm sm:text-xl font-bold text-white">VigiaLink</h1>
                <p className="text-blue-100 text-xs sm:text-sm hidden sm:block">Sistema de Rastreamento GPS Profissional</p>
                <p className="text-blue-100 text-xs sm:hidden">GPS Pro</p>
              </div>
            </div>
            <div className="flex flex-row sm:flex-row items-center sm:items-center space-x-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center text-white text-xs sm:text-base">
                <User className="w-5 h-5 mr-2" />
                <span className="truncate max-w-20 sm:max-w-none text-xs sm:text-base">{user?.full_name?.split(' ')[0]} {!isOnline && '(Off)'}</span>
              </div>
              {!isOnline && (
                <div className="flex items-center text-orange-300 text-xs sm:text-sm">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mr-2 animate-pulse"></div>
                  <span className="hidden sm:inline">Offline</span>
                </div>
              )}
              <div className="flex flex-row space-x-1 sm:space-x-2">
                <button
                  onClick={handleRefresh}
                  className="bg-white/20 text-white p-2 rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline sm:ml-1">Atualizar</span>
                </button>
                <button
                  onClick={() => {
                    console.log('Refresh forçado do dashboard');
                    onForceRefresh?.();
                  }}
                  className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline sm:ml-1">Sincronizar</span>
                </button>
              </div>
              <button
                onClick={onLogout}
                className="text-white hover:text-blue-200 p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total de Rastreamentos</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{trackingSessions.length}</p>
                <p className="text-xs text-gray-500">{currentSessions}/{allowedSessions} em uso</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">GPS Ativos</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">{activeSessions.length}</p>
                <p className="text-xs text-green-500">AO VIVO</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-yellow-500 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Aguardando</p>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{pendingSessions.length}</p>
                <p className="text-xs text-yellow-500">Pendentes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Resumo de Atividade Recente */}
        {activeSessions.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-green-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Zap className="w-5 h-5 text-green-600 mr-2" />
              <span className="hidden sm:inline">RASTREAMENTOS ATIVOS - GPS AO VIVO</span>
              <span className="sm:hidden">GPS AO VIVO</span>
            </h3>
            <div className="space-y-3">
              {activeSessions.slice(0, 3).map((session, index) => (
                <div key={session.id || index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-white rounded-lg shadow-sm border border-green-200 space-y-2 sm:space-y-0">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-red-500 rounded-full mr-3 animate-pulse"></div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm sm:text-base">{session.tracked_user_name}</p>
                      <p className="text-xs sm:text-sm text-green-600 font-medium">
                        <span className="hidden sm:inline">GPS ATIVO - Localização em tempo real</span>
                        <span className="sm:hidden">GPS ATIVO</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                    <button
                      onClick={() => onStartGPSMap?.(session)}
                      className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center font-bold text-xs sm:text-sm w-full sm:w-auto"
                    >
                      <Map className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">ACOMPANHE GPS</span>
                      <span className="sm:hidden">MAPA</span>
                    </button>
                    <button
                      onClick={() => onSelectSession(session)}
                      className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center text-xs sm:text-sm w-full sm:w-auto"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Ver Histórico</span>
                      <span className="sm:hidden">Histórico</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mb-4 sm:mb-6">
          <div className="w-full">
            {canCreateMore ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className={`px-4 py-3 rounded-lg transition-colors flex items-center justify-center font-bold text-sm sm:text-base ${
                  isOnline && user
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg' 
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                } w-full`}
                disabled={!isOnline || !user}
                title={!user ? 'Faça login para criar rastreamentos' : !isOnline ? 'Conecte-se à internet para criar novos rastreamentos' : ''}
              >
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{!user ? 'Login Necessário' : isOnline ? 'CRIAR RASTREAMENTO' : 'Offline'}</span>
                <span className="sm:hidden">{!user ? 'Login' : isOnline ? 'CRIAR' : 'Offline'}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowVoucherModal(true)}
                className="px-4 py-3 rounded-lg transition-colors flex items-center justify-center font-bold text-sm sm:text-base bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 shadow-lg w-full"
                disabled={!user}
              >
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">ADICIONAR MAIS RASTREAMENTOS</span>
                <span className="sm:hidden">ADICIONAR MAIS</span>
              </button>
            )}
          </div>
          
          {/* Plan Info */}
          <div className="mt-3 text-center">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Plano Atual:</span> {allowedSessions === 2 ? 'Básico (R$ 29,90/mês)' : `Expandido (${allowedSessions} rastreamentos)`}
            </p>
            <p className="text-xs text-gray-500">
              {canCreateMore 
                ? `Você pode criar mais ${allowedSessions - currentSessions} rastreamento(s)`
                : 'Limite atingido - Use vouchers para adicionar mais (R$ 9,90 cada)'
              }
            </p>
          </div>
        </div>

        {/* Tracking Sessions List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {!trackingSessions || trackingSessions.length === 0 ? (
            <div className="text-center py-8 sm:py-16 px-4">
              <div className="bg-blue-100 rounded-full p-4 sm:p-6 w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Satellite className="w-8 h-8 sm:w-12 sm:h-12 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Nenhum Rastreamento Criado</h3>
              <p className="text-gray-500 mb-4 text-sm sm:text-base">Crie seu primeiro sistema de rastreamento GPS</p>
              <p className="text-xs sm:text-sm text-gray-400 px-2">
                <span className="hidden sm:inline">Funciona em qualquer lugar do mundo | Rastreamento em tempo real | 100% Seguro</span>
                <span className="sm:hidden">Mundial | Tempo real | Seguro</span>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-blue-50">
                  <tr>
                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      <span className="hidden sm:inline">PESSOA RASTREADA</span>
                      <span className="sm:hidden">PESSOA</span>
                    </th>
                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      <span className="hidden sm:inline">STATUS GPS</span>
                      <span className="sm:hidden">STATUS</span>
                    </th>
                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                      CRIADO EM
                    </th>
                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      <span className="hidden sm:inline">LINK DE ATIVAÇÃO</span>
                      <span className="sm:hidden">LINK</span>
                    </th>
                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      <span className="hidden sm:inline">AÇÕES</span>
                      <span className="sm:hidden">AÇÕES</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {trackingSessions.map((session, index) => (
                    <tr key={session.id || index} className="hover:bg-blue-50 transition-colors">
                      <td className="px-2 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3 ${
                            session.status === 'active' ? 'bg-red-500 animate-pulse' : 
                            session.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-400'
                          }`}></div>
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              <span className="block sm:hidden">{session.tracked_user_name.split(' ')[0]}</span>
                              <span className="hidden sm:block">{session.tracked_user_name}</span>
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                              {session.tracked_user_phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`px-2 sm:px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(session.status)}`}>
                          <span className="hidden sm:inline">{getStatusText(session.status)}</span>
                          <span className="sm:hidden">{session.status === 'active' ? 'ATIVO' : session.status === 'pending' ? 'Pendente' : 'Inativo'}</span>
                        </span>
                      </td>
                      <td className="px-2 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden sm:table-cell">
                        {new Date(session.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-2 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <button
                          onClick={() => copyLink(`${window.location.origin}?token=${session.invite_token}`)}
                          className="bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700 transition-colors flex items-center font-bold text-xs w-full sm:w-auto justify-center"
                        >
                          <Satellite className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">Link</span>
                          <span className="sm:hidden">Link</span>
                        </button>
                      </td>
                      <td className="px-2 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col sm:flex-row flex-wrap gap-1">
                          {session.status === 'active' && (
                            <>
                              <button
                                onClick={() => onStartGPSMap?.(session)}
                                className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition-colors flex items-center font-bold justify-center w-full sm:w-auto"
                              >
                                <Map className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">MAPA</span>
                                <span className="sm:hidden">MAPA</span>
                              </button>
                              <button
                                onClick={() => onSelectSession(session)}
                                className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition-colors flex items-center justify-center w-full sm:w-auto"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">Histórico</span>
                                <span className="sm:hidden">HIST</span>
                              </button>
                              <button
                                onClick={() => handleStopTracking(session.id)}
                                className="bg-orange-600 text-white px-2 py-1 rounded text-xs hover:bg-orange-700 transition-colors flex items-center justify-center w-full sm:w-auto"
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">Parar</span>
                                <span className="sm:hidden">Parar</span>
                              </button>
                            </>
                          )}
                          {(session.status === 'inactive' || session.status === 'pending') && (
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition-colors flex items-center justify-center w-full sm:w-auto"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              <span className="hidden sm:inline">Excluir</span>
                              <span className="sm:hidden">Excluir</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] sm:max-h-[80vh] overflow-y-auto p-4 sm:p-6 shadow-2xl mx-2">
            <div className="text-center mb-6">
              <div className="bg-blue-100 rounded-full p-3 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <Satellite className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                Criar Rastreamento GPS
              </h3>
            </div>
            
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200 text-center sm:text-left">
              <h4 className="font-semibold text-blue-900 mb-2 text-sm">Como Funciona:</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>Crie um link único e seguro</li>
                <li>Envie para a pessoa que você quer proteger</li>
                <li>GPS ativa automaticamente quando aceitar</li>
                <li>Rastreamento em tempo real 24/7</li>
                <li>Funciona em qualquer lugar do mundo</li>
              </ul>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nome da Pessoa a Proteger
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  placeholder="Ex: Maria Silva"
                  required
                  disabled={isCreating}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Telefone (Opcional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  placeholder="(11) 99999-9999"
                  disabled={isCreating}
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm w-full sm:w-auto"
                  disabled={isCreating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center justify-center font-semibold text-sm w-full sm:w-auto ${
                    isOnline && !isCreating && user
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg' 
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
                  disabled={!isOnline || isCreating || !user}
                >
                  {isCreating ? (
                    <>
                      <Activity className="w-4 h-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Criando...</span>
                      <span className="sm:hidden">Criando</span>
                    </>
                  ) : !user ? (
                    <>
                      <span className="hidden sm:inline">Login Necessário</span>
                      <span className="sm:hidden">Login</span>
                    </>
                  ) : isOnline ? (
                    <>
                      <Satellite className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">CRIAR RASTREAMENTO</span>
                      <span className="sm:hidden">CRIAR</span>
                    </>
                  ) : (
                    'Sem Conexão'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voucher Redemption Modal */}
      <VoucherRedemptionModal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        onSuccess={() => {
          // Refresh user profile and sessions
          onForceRefresh?.();
          window.location.reload(); // Force full refresh to update profile
        }}
        currentSessions={currentSessions}
        allowedSessions={allowedSessions}
      />

      {/* Floating Help Button */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowFloatingHelp(!showFloatingHelp)}
          className="bg-green-600 text-white p-4 rounded-full shadow-2xl hover:bg-green-700 transition-all duration-300 transform hover:scale-110 animate-pulse"
          title="Precisa de ajuda? Clique aqui!"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
        
        {/* Floating Help Popup */}
        {showFloatingHelp && (
          <div className="absolute bottom-16 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-64 max-w-[85vw] animate-in slide-in-from-bottom-2 duration-300">
            <div className="text-center mb-4">
              <div className="bg-green-100 rounded-full p-2 w-10 h-10 flex items-center justify-center mx-auto mb-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">
                Precisa de Ajuda?
              </h3>
              <p className="text-sm text-gray-600">
                Fale conosco via WhatsApp!
              </p>
            </div>
            
            <div className="space-y-2 mb-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                <h4 className="font-semibold text-green-900 mb-1 text-sm">
                  Suporte Imediato
                </h4>
                <p className="text-green-800 text-xs mb-2">
                  Nossa equipe está pronta para ajudar!
                </p>
                <button
                  onClick={openWhatsApp}
                  className="w-full bg-green-600 text-white px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center font-semibold text-xs"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Abrir WhatsApp
                </button>
                <div className="mt-1 text-center">
                  <p className="text-green-700 text-xs font-mono">
                    Telefone: +55 66 99206-8545
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                <h4 className="font-semibold text-blue-900 mb-1 text-xs">
                  Problemas Comuns
                </h4>
                <div className="text-blue-800 text-xs space-y-0.5">
                  <p>• GPS não funciona? Aceite o convite</p>
                  <p>• Link não abre? Cole no navegador</p>
                  <p>• Mais rastreamentos? Use vouchers</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <button
                onClick={openWhatsApp}
                className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors flex items-center font-bold text-xs"
              >
                <Phone className="w-4 h-4 mr-1" />
                FALAR AGORA
              </button>
              
              <button
                onClick={() => setShowFloatingHelp(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                X
              </button>
            </div>
            
            <div className="mt-2 text-center">
              <p className="text-xs text-gray-500">
                VigiaLink - Suporte 24/7
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};