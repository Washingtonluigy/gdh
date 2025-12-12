import React, { useState } from 'react';
import { Shield, Mail, Lock, UserPlus } from 'lucide-react';

interface LoginFormProps {
  onLogin: (email: string, password: string) => void;
  onNavigateToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin, onNavigateToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      await onLogin(email, password);
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 w-full max-w-md mx-2 sm:mx-4">
        <div className="text-center mb-8">
          <div className="bg-blue-100 rounded-full p-3 sm:p-4 w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mx-auto mb-4">
            <img 
              src="/a-modern-logo-design-featuring-a-stylize_V-pwcN2yQoKBSk9UUsAm6A_zcNnTwtaQniaKzNe0_Zg4g.png" 
              alt="VigiaLink Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">VigiaLink</h1>
          <p className="text-sm sm:text-base text-gray-600 px-2">Proteção e Segurança para sua Família</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2 sm:py-3 px-4 rounded-lg font-semibold transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm sm:text-base ${
              isSubmitting 
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-4 sm:mt-6 text-center">
          <p className="text-sm sm:text-base text-gray-600">
            Não tem uma conta?{' '}
            <button
              onClick={onNavigateToRegister}
              className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center text-sm sm:text-base"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Cadastre-se
            </button>
          </p>
        </div>

        <div className="mt-6 sm:mt-8 text-center">
          <p className="text-xs text-gray-500">
            Sistema em conformidade com LGPD
          </p>
        </div>
      </div>
    </div>
  );
};