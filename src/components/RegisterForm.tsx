import React, { useState } from 'react';
import { Shield, Mail, Lock, User, Phone, ArrowLeft } from 'lucide-react';

interface RegisterFormProps {
  onRegister: (userData: { name: string; email: string; phone: string; password: string }) => void;
  onNavigateToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onRegister, onNavigateToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    if (formData.password !== formData.confirmPassword) {
      alert('As senhas não coincidem');
      return;
    }
    if (!formData.acceptedTerms) {
      alert('É necessário aceitar os termos de uso');
      return;
    }
    
    if (formData.password.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    try {
      setIsSubmitting(true);
      await onRegister({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 w-full max-w-md mx-2 sm:mx-4 max-h-[95vh] overflow-y-auto">
        <div className="text-center mb-8">
          <div className="bg-blue-100 rounded-full p-3 sm:p-4 w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mx-auto mb-4">
            <img 
              src="/a-modern-logo-design-featuring-a-stylize_V-pwcN2yQoKBSk9UUsAm6A_zcNnTwtaQniaKzNe0_Zg4g.png" 
              alt="VigiaLink Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">VigiaLink</h1>
          <p className="text-sm sm:text-base text-gray-600 px-2">Criar Conta - Proteja quem você ama</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Nome Completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                placeholder="João Silva"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                placeholder="seu@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Telefone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                placeholder="(11) 99999-9999"
                required
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
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Confirmar Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="flex items-start">
            <input
              type="checkbox"
              name="acceptedTerms"
              checked={formData.acceptedTerms}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              required
            />
            <label className="ml-2 block text-sm text-gray-600">
              Eu concordo com os{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700">
                Termos de Uso
              </a>{' '}
              e{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700">
                Política de Privacidade
              </a>
            </label>
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
            {isSubmitting ? 'Criando conta...' : 'Criar Conta'}
          </button>
        </form>

        <div className="mt-4 sm:mt-6 text-center">
          <button
            onClick={onNavigateToLogin}
            className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar para Login
          </button>
        </div>
      </div>
    </div>
  );
};