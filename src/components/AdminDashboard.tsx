import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  Ticket, 
  LogOut,
  RefreshCw,
  User,
  Eye,
  Lock,
  Unlock,
  Copy,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Calendar,
  Phone,
  Mail,
  CreditCard
} from 'lucide-react';
import { Profile, UserData, VoucherStats, trackingAPI } from '../lib/supabase';

interface AdminDashboardProps {
  user: Profile | null;
  onLogout: () => void;
  isOnline?: boolean;
  onForceRefresh?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  onLogout,
  isOnline = true,
  onForceRefresh,
}) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [voucherStats, setVoucherStats] = useState<VoucherStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherCount, setVoucherCount] = useState(1);
  const [generatedVouchers, setGeneratedVouchers] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Check admin user status on component mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const adminCheck = await trackingAPI.checkAdminUserExists();
        console.log('Admin user status:', adminCheck);
        
        if (adminCheck && adminCheck.length > 0) {
          const status = adminCheck[0];
          if (!status.user_exists || !status.profile_exists) {
            console.warn('Admin user or profile missing');
          } else {
            console.log('Admin user verified:', {
              email: status.user_email,
              role: status.profile_role,
              sessions: status.allowed_sessions
            });
          }
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };

    if (user?.role === 'admin') {
      checkAdminStatus();
    }
  }, [user]);

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Loading admin data...');
      
      const [usersData, statsData] = await Promise.all([
        trackingAPI.getAllUserProfiles(),
        trackingAPI.getVoucherStats()
      ]);
      
      setUsers(usersData);
      setVoucherStats(statsData);
      setLastRefresh(new Date());
      console.log('Admin data loaded:', { users: usersData.length, stats: statsData });
    } catch (error) {
      console.error('Error loading admin data:', error);
      alert('Erro ao carregar dados: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadData();
    }
  }, [user]);

  const handleRefresh = () => {
    console.log('Manual refresh');
    loadData();
    onForceRefresh?.();
  };

  const handleBlockUser = async (userId: string, blockStatus: boolean, userName: string) => {
    const action = blockStatus ? 'bloquear' : 'desbloquear';
    if (confirm(`Tem certeza que deseja ${action} o usuário "${userName}"?`)) {
      try {
        const result = await trackingAPI.blockUserAccess(userId, blockStatus);
        if (result.success) {
          alert(result.message);
          loadData(); // Refresh data
        } else {
          alert('Erro: ' + result.error);
        }
      } catch (error) {
        console.error('Error blocking user:', error);
        alert('Erro ao ' + action + ' usuário: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      }
    }
  };

  const handleGenerateVouchers = async () => {
    if (voucherCount < 1 || voucherCount > 100) {
      alert('Quantidade deve ser entre 1 e 100 vouchers');
      return;
    }

    try {
      setIsGenerating(true);
      const result = await trackingAPI.generateVoucher(voucherCount);
      
      if (result.success) {
        setGeneratedVouchers(result.voucher_codes);
        alert(`${result.count} voucher(s) gerado(s) com sucesso!`);
        loadData(); // Refresh stats
      } else {
        alert('Erro: ' + result.error);
      }
    } catch (error) {
      console.error('Error generating vouchers:', error);
      alert('Erro ao gerar vouchers: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSyncUsers = async () => {
    if (confirm('Tem certeza que deseja sincronizar usuários existentes? Isso criará perfis para usuários que já usam o sistema mas não aparecem na lista.')) {
      try {
        setIsSyncing(true);
        const result = await trackingAPI.syncExistingUsers();
        
        if (result.success) {
          alert(`Sincronização concluída! ${result.synced_count} usuário(s) sincronizado(s).`);
          loadData(); // Refresh data
        } else {
          alert('Erro na sincronização: ' + result.error);
        }
      } catch (error) {
        console.error('Error syncing users:', error);
        alert('Erro ao sincronizar usuários: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Código copiado para a área de transferência!');
    }).catch(() => {
      alert('Erro ao copiar código. Copie manualmente: ' + text);
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando painel administrativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-white mr-3" />
              <div>
                <h1 className="text-xl font-bold text-white">Painel Administrativo</h1>
                <p className="text-purple-100 text-sm">VigiaLink - Sistema de Gestão</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-white text-sm">
                <User className="w-4 h-4 inline mr-1" />
                {user?.full_name} (Admin)
              </div>
              <button
                onClick={handleRefresh}
                className="bg-white/20 text-white p-2 rounded-lg hover:bg-white/30 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={onLogout}
                className="text-white hover:text-purple-200 p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Clientes</p>
                <p className="text-3xl font-bold text-gray-900">{users.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rastreamentos Ativos</p>
                <p className="text-3xl font-bold text-green-600">
                  {users.reduce((sum, user) => sum + user.active_sessions_count, 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Ticket className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Vouchers Disponíveis</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {voucherStats?.unused_vouchers || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Vouchers Usados</p>
                <p className="text-3xl font-bold text-purple-600">
                  {voucherStats?.used_vouchers || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => setShowVoucherModal(true)}
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-blue-700 transition-colors flex items-center font-semibold shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Gerar Vouchers
            </button>
            
            <button
              onClick={handleSyncUsers}
              disabled={isSyncing}
              className={`px-6 py-3 rounded-lg font-semibold shadow-lg transition-colors flex items-center ${
                isSyncing
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
              }`}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5 mr-2" />
                  Sincronizar Usuários
                </>
              )}
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <Users className="w-6 h-6 mr-2 text-blue-600" />
              Clientes Cadastrados ({users.length})
            </h3>
            <p className="text-gray-600 mt-1">Gerencie todos os clientes do sistema</p>
          </div>
          
          {users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum cliente cadastrado</h3>
              <p className="text-gray-500">Os clientes aparecerão aqui quando se cadastrarem no sistema</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plano
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rastreamentos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cadastro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((userData) => (
                    <tr key={userData.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {userData.full_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {userData.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {userData.allowed_sessions === 2 ? 'Básico (R$ 29,90)' : `Expandido (${userData.allowed_sessions} rastreamentos)`}
                        </div>
                        <div className="text-sm text-gray-500">
                          {userData.allowed_sessions} rastreamentos permitidos
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <span className="font-bold text-green-600">{userData.active_sessions_count}</span> ativos
                        </div>
                        <div className="text-sm text-gray-500">
                          {userData.total_sessions_count} total criados
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          userData.is_blocked 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {userData.is_blocked ? 'Bloqueado' : 'Ativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(userData.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => setSelectedUser(userData)}
                          className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </button>
                        <button
                          onClick={() => handleBlockUser(userData.id, !userData.is_blocked, userData.full_name)}
                          className={`inline-flex items-center ${
                            userData.is_blocked 
                              ? 'text-green-600 hover:text-green-900' 
                              : 'text-red-600 hover:text-red-900'
                          }`}
                        >
                          {userData.is_blocked ? (
                            <>
                              <Unlock className="w-4 h-4 mr-1" />
                              Desbloquear
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4 mr-1" />
                              Bloquear
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Vouchers */}
        {voucherStats?.recent_vouchers && voucherStats.recent_vouchers.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <Ticket className="w-6 h-6 mr-2 text-yellow-600" />
                Vouchers Recentes (últimos 30 dias)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usado por
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data de Uso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Criado em
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {voucherStats.recent_vouchers.slice(0, 10).map((voucher, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {voucher.code}
                          </code>
                          <button
                            onClick={() => copyToClipboard(voucher.code)}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          voucher.is_used 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {voucher.is_used ? 'Usado' : 'Disponível'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {voucher.used_by || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {voucher.used_at ? formatDate(voucher.used_at) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(voucher.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  Detalhes do Cliente
                </h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo
                  </label>
                  <p className="text-gray-900 bg-gray-50 p-2 rounded">{selectedUser.full_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone
                  </label>
                  <p className="text-gray-900 bg-gray-50 p-2 rounded">{selectedUser.phone || 'Não informado'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rastreamentos Permitidos
                  </label>
                  <p className="text-gray-900 bg-gray-50 p-2 rounded">{selectedUser.allowed_sessions}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rastreamentos Ativos
                  </label>
                  <p className="text-gray-900 bg-gray-50 p-2 rounded">{selectedUser.active_sessions_count}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total de Rastreamentos Criados
                  </label>
                  <p className="text-gray-900 bg-gray-50 p-2 rounded">{selectedUser.total_sessions_count}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status da Conta
                  </label>
                  <p className={`p-2 rounded font-medium ${
                    selectedUser.is_blocked 
                      ? 'text-red-800 bg-red-50' 
                      : 'text-green-800 bg-green-50'
                  }`}>
                    {selectedUser.is_blocked ? 'Bloqueada' : 'Ativa'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Cadastro
                  </label>
                  <p className="text-gray-900 bg-gray-50 p-2 rounded">{formatDate(selectedUser.created_at)}</p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleBlockUser(selectedUser.id, !selectedUser.is_blocked, selectedUser.full_name)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedUser.is_blocked
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {selectedUser.is_blocked ? 'Desbloquear Cliente' : 'Bloquear Cliente'}
                </button>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Generation Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  Gerar Vouchers
                </h3>
                <button
                  onClick={() => {
                    setShowVoucherModal(false);
                    setGeneratedVouchers([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {generatedVouchers.length === 0 ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantidade de Vouchers
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={voucherCount}
                      onChange={(e) => setVoucherCount(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Cada voucher libera +1 rastreamento (R$ 9,90)
                    </p>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowVoucherModal(false);
                        setGeneratedVouchers([]);
                      }}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleGenerateVouchers}
                      disabled={isGenerating}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        isGenerating
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isGenerating ? 'Gerando...' : 'Gerar Vouchers'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <h4 className="text-lg font-bold text-gray-900 mb-2">
                      Vouchers Gerados com Sucesso!
                    </h4>
                    <p className="text-gray-600 mb-4">
                      {generatedVouchers.length} voucher(s) criado(s). Copie os códigos abaixo:
                    </p>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {generatedVouchers.map((code, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <code className="font-mono text-lg font-bold text-blue-600">
                          {code}
                        </code>
                        <button
                          onClick={() => copyToClipboard(code)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setShowVoucherModal(false);
                        setGeneratedVouchers([]);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};