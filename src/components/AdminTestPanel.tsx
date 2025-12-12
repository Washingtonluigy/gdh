import React, { useState } from 'react';
import { Shield, CheckCircle, XCircle, User, Key, Database } from 'lucide-react';
import { trackingAPI } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export const AdminTestPanel: React.FC = () => {
  const { signIn } = useAuth();
  const [testing, setTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [loginTest, setLoginTest] = useState<any>(null);

  const createAdminUser = async () => {
    setIsLoading(true);
    try {
      // Tentar criar o usuário admin via signUp
      const { data, error } = await supabase.auth.signUp({
        email: 'masterlink@acesso.com',
        password: 'vigia_link2025**',
        options: {
          data: {
            full_name: 'Master Administrator',
            role: 'admin'
          }
        }
      });

      if (error) {
        console.error('Erro ao criar usuário admin:', error);
        setTestResults({
          success: false,
          error: error.message,
          message: 'Erro ao criar usuário administrador'
        });
        return;
      }

      console.log('Usuário admin criado:', data);
      setTestResults({
        success: true,
        message: 'Usuário administrador criado com sucesso!',
        user_id: data.user?.id
      });

    } catch (error) {
      console.error('Erro inesperado:', error);
      setTestResults({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        message: 'Erro inesperado ao criar usuário'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testAdminUser = async () => {
    setTesting(true);
    setTestResults(null);
    setLoginTest(null);

    try {
      console.log('🔍 Verificando usuário administrador...');
      
      // 1. Verificar se o usuário admin existe no banco
      const adminCheck = await trackingAPI.checkAdminUserExists();
      console.log('HIST Resultado da verificação:', adminCheck);
      
      setTestResults(adminCheck);

      // 2. Tentar fazer login com as credenciais
      console.log('🔐 Testando login do administrador...');
      const loginResult = await signIn('masterlink@acesso.com', 'vigia_link2025**');
      
      if (loginResult.error) {
        setLoginTest({
          success: false,
          error: loginResult.error.message,
          details: loginResult.error
        });
      } else {
        setLoginTest({
          success: true,
          user: loginResult.data?.user,
          session: loginResult.data?.session
        });
      }

    } catch (error) {
      console.error('Erro no teste:', error);
      setTestResults({
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-md z-50">
      <div className="flex items-center mb-3">
        <Shield className="w-5 h-5 text-blue-600 mr-2" />
        <h3 className="font-bold text-gray-900">Teste Admin</h3>
      </div>

      <button
        onClick={testAdminUser}
        disabled={testing}
        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
          testing
            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {testing ? 'Testando...' : 'Verificar Admin'}
      </button>

      <button
        onClick={createAdminUser}
        disabled={isLoading}
        className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50"
      >
        {isLoading ? 'Criando...' : 'Criar Admin'}
      </button>

      {testResults && (
        <div className="mt-4 space-y-2">
          <h4 className="font-medium text-gray-900 flex items-center">
            <Database className="w-4 h-4 mr-2" />
            Status do Banco:
          </h4>
          
          {testResults.error ? (
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <div className="flex items-center text-red-800">
                <XCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">Erro: {testResults.error}</span>
              </div>
            </div>
          ) : testResults.length > 0 ? (
            <div className="space-y-2">
              {testResults.map((result: any, index: number) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded p-2">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center">
                      {result.user_exists ? (
                        <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-600 mr-1" />
                      )}
                      <span>Usuário: {result.user_exists ? 'Existe' : 'Não existe'}</span>
                    </div>
                    <div className="flex items-center">
                      {result.profile_exists ? (
                        <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-600 mr-1" />
                      )}
                      <span>Perfil: {result.profile_exists ? 'Existe' : 'Não existe'}</span>
                    </div>
                    <div className="text-gray-600">
                      <div>Email: {result.user_email}</div>
                      <div>Role: {result.profile_role}</div>
                      <div>Sessões: {result.allowed_sessions}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
              <span className="text-yellow-800 text-sm">Nenhum resultado retornado</span>
            </div>
          )}
        </div>
      )}

      {loginTest && (
        <div className="mt-4">
          <h4 className="font-medium text-gray-900 flex items-center">
            <Key className="w-4 h-4 mr-2" />
            Teste de Login:
          </h4>
          
          {loginTest.success ? (
            <div className="bg-green-50 border border-green-200 rounded p-2 mt-2">
              <div className="flex items-center text-green-800">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">Login realizado com sucesso!</span>
              </div>
              <div className="text-xs text-green-700 mt-1">
                <div>ID: {loginTest.user?.id}</div>
                <div>Email: {loginTest.user?.email}</div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
              <div className="flex items-center text-red-800">
                <XCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">Erro no login</span>
              </div>
              <div className="text-xs text-red-700 mt-1">
                {loginTest.error}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        <div>Email: masterlink@acesso.com</div>
        <div>Senha: vigia_link2025**</div>
      </div>
    </div>
  );
};