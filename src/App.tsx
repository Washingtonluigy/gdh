import React, { useEffect, useState } from 'react';
import { Bell, X, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useTracking } from './hooks/useTracking';
import { useInvite } from './hooks/useInvite';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ConsentPage } from './components/ConsentPage';
import { LocationViewer } from './components/LocationViewer';
import { TrackingActive } from './components/TrackingActive';
import { GPSTracker } from './components/GPSTracker';
import { GPSMapTracker } from './components/GPSMapTracker';
import { AdminTestPanel } from './components/AdminTestPanel';

type Page = 'login' | 'register' | 'dashboard' | 'consent' | 'location-viewer' | 'tracking-active' | 'gps-tracker' | 'gps-map';

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

function App() {
  const { user, profile, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const { 
    sessions, 
    locations, 
    loading: trackingLoading, 
    forceRefresh,
    createSession, 
    acceptInvite, 
    startLocationTracking,
    stopLocationTracking,
    updateSessionStatus,
    deleteSession,
    loadLocations,
    getSessionByToken
  } = useTracking();

  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);
  const [acceptedTokens, setAcceptedTokens] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const { invite, loading: inviteLoading, error: inviteError } = useInvite(inviteToken);

  // Add notification function
  const addNotification = (type: Notification['type'], title: string, message: string) => {
    if (!title || !message || title.trim() === '' || message.trim() === '') {
      console.warn('Tentativa de criar notificação inválida:', { type, title, message });
      return;
    }
    
    const notification: Notification = {
      id: Date.now().toString(),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false
    };
    
    setNotifications(prev => {
      // Evitar duplicatas
      const exists = prev.some(n => 
        n.title === title && 
        n.message === message && 
        (Date.now() - n.timestamp.getTime()) < 5000 // Evitar duplicatas em 5 segundos
      );
      if (exists) return prev;
      
      return [notification, ...prev.slice(0, 9)]; // Keep only 10 notifications
    });
  };

  // Mark notification as read
  const markAsRead = (id: string) => {
    if (!id || id.trim() === '') return;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
    setShowNotifications(false);
  };

  // Load accepted tokens from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('rastreia_familia_accepted_tokens');
      if (stored) {
        setAcceptedTokens(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.error('Error loading accepted tokens:', error);
    }
  }, []);

  // Save accepted tokens to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('rastreia_familia_accepted_tokens', JSON.stringify(Array.from(acceptedTokens)));
    } catch (error) {
      console.error('Error saving accepted tokens:', error);
    }
  }, [acceptedTokens]);

  // Check for invite token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      console.log('Token detected in URL:', token);
      setInviteToken(token);
      setCurrentPage('consent');
      // Clear token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Handle authentication state and navigation
  useEffect(() => {
    console.log('🔍 Auth state:', {
      user: !!user,
      userEmail: user?.email,
      profile: !!profile,
      profileRole: profile?.role,
      authLoading,
      inviteToken,
      currentPage
    });

    if (authLoading) {
      console.log('⏳ Still loading auth...');
      return;
    }

    if (inviteToken) {
      // Has invite token
      if (acceptedTokens.has(inviteToken)) {
        if (currentPage !== 'tracking-active') {
          console.log('👤 Token already accepted - going to tracking-active');
          // addNotification('info', 'Rastreamento Ativo', 'Você já aceitou este convite de rastreamento');
          setCurrentPage('tracking-active');
        }
      } else {
        if (currentPage !== 'consent') {
          console.log('👤 New token - going to consent');
          // addNotification('info', 'Novo Convite', 'Você recebeu um convite de rastreamento');
          setCurrentPage('consent');
        }
      }
    } else {
      // No invite token
      if (!user) {
        // Not authenticated - go to login
        if (currentPage !== 'login' && currentPage !== 'register') {
          console.log('👤 Not authenticated - going to login');
          // addNotification('warning', 'Login Necessário', 'Faça login para acessar o sistema');
          setCurrentPage('login');
        }
      } else {
        // Authenticated - go to dashboard
        if (currentPage !== 'tracking-active' && currentPage !== 'location-viewer' &&
            currentPage !== 'gps-tracker' && currentPage !== 'gps-map' &&
            currentPage !== 'dashboard') {
          console.log('✅ Authenticated - going to dashboard', {
            currentPage,
            userEmail: user?.email,
            profileRole: profile?.role
          });
          setCurrentPage('dashboard');
        } else {
          console.log('📍 Already on correct page:', currentPage);
        }
      }
    }
  }, [user, profile, authLoading, inviteToken, currentPage, acceptedTokens]);

  const handleAcceptTracking = async () => {
    if (!inviteToken) return;

    try {
      // Mark token as accepted
      setAcceptedTokens(prev => new Set([...prev, inviteToken]));
      const result = await acceptInvite(inviteToken);
      // Force refresh to update all tabs
      forceRefresh();

      // Add success notification instead of alert
      addNotification('success', 'Rastreamento Ativado!', `Proteção ativada com sucesso! Sua localização será compartilhada com segurança.`);

      // Go to tracking active page
      setCurrentPage('tracking-active');

      // Start location tracking
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('GPS permission granted:', position.coords);
            addNotification('success', 'GPS Ativado', `Localização obtida com precisão de ${position.coords.accuracy?.toFixed(1)}m`);
            const watchId = startLocationTracking(result.session_id || result.session?.id);
            setLocationWatchId(watchId);
            console.log('🛰️ Tracking started with ID:', watchId);
          },
          (error) => {
            addNotification('warning', 'GPS Limitado', 'Permissão de GPS negada. Usando dados simulados para demonstração.');
            console.error('GPS permission error:', error);
            // Start tracking anyway with mock data
            const watchId = startLocationTracking(result.session_id || result.session?.id);
            setLocationWatchId(watchId);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      }

    } catch (error) {
      console.error('Error accepting tracking:', error);
      addNotification('error', 'Erro no Rastreamento', error instanceof Error ? error.message : 'Erro desconhecido ao aceitar rastreamento');
      throw error; // Re-throw so ConsentPage can handle the display
    }
  };

  const handleStopTracking = async (sessionId?: string) => {
    try {
      if (sessionId) {
        await updateSessionStatus(sessionId, 'inactive');
      }
      
      // Stop location tracking
      if (locationWatchId) {
        stopLocationTracking(locationWatchId);
        setLocationWatchId(null);
      }

      // Remove token from accepted tokens
      if (inviteToken) {
        setAcceptedTokens(prev => {
          const newSet = new Set(prev);
          newSet.delete(inviteToken);
          return newSet;
        });
      }

      // Clear invite token and go back to login
      setInviteToken(null);
      setCurrentPage('login');
    } catch (error) {
      console.error('Error stopping tracking:', error);
      addNotification('error', 'Erro', 'Erro ao parar rastreamento');
    }
  };

  const handleRejectTracking = () => {
    setInviteToken(null);
    setCurrentPage('login');
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const result = await signIn(email, password);
      const { data, error } = result;
      
      if (error) {
        console.error('Login error:', error);
        if (error.message.includes('Invalid login credentials')) {
          addNotification('error', 'Login Falhou', 'Email ou senha incorretos. Verifique suas credenciais.');
        } else {
          addNotification('error', 'Erro de Login', error.message);
        }
        return;
      }

      console.log('Login successful:', data?.user?.email);
      
      // Verificar se é admin
      const isAdmin = data?.user?.email === 'masterlink@acesso.com';
      const welcomeMessage = isAdmin 
        ? 'Bem-vindo ao Painel Administrativo!' 
        : 'Bem-vindo ao VigiaLink!';
      
      addNotification('success', 'Login Realizado', welcomeMessage);
    } catch (error) {
      console.error('Login catch error:', error);
      addNotification('error', 'Erro', 'Erro inesperado no login');
    }
  };

  const handleRegister = async (userData: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => {
    try {
      const { data, error } = await signUp(userData.email, userData.password, userData.name, userData.phone);
      if (error) {
        console.error('Registration error:', error);
        addNotification('error', 'Erro no Cadastro', error.message);
        return;
      }
      
      if (data.user) {
        addNotification('success', 'Conta Criada!', 'Sua conta foi criada com sucesso. Você já pode fazer login.');
        setCurrentPage('login');
      }
    } catch (error) {
      console.error('Registration error:', error);
      addNotification('error', 'Erro', 'Erro inesperado no cadastro');
    }
  };

  const handleCreateSession = async (name: string, phone: string) => {
    try {
      console.log('Creating session for:', { name, phone });
      const session = await createSession(name, phone);
      console.log('Session created:', session);
      
      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      addNotification('error', 'Erro ao Criar Sessão', error instanceof Error ? error.message : 'Erro desconhecido');
      throw error;
    }
  };

  const handleSelectSession = (session: any) => {
    console.log(' Selecting session for viewing:', session);
    setSelectedSession(session);
    if (session && session.id) {
      loadLocations(session.id);
    }
    setCurrentPage('location-viewer');
  };

  const handleStartGPSTracking = (session: any) => {
    console.log('🛰️ Starting GPS tracking for session:', session);
    setSelectedSession(session);
    if (session && session.id) {
      loadLocations(session.id);
    }
    setCurrentPage('gps-tracker');
  };

  const handleStartGPSMap = (session: any) => {
    console.log('MAPA Starting GPS map for session:', session);
    setSelectedSession(session);
    if (session && session.id) {
      loadLocations(session.id);
    }
    setCurrentPage('gps-map');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'error': return <X className="w-4 h-4 text-red-600" />;
      default: return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getNotificationBg = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'error': return 'bg-red-50 border-red-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'login':
        return (
          <LoginForm
            onLogin={handleLogin}
            onNavigateToRegister={() => setCurrentPage('register')}
          />
        );
      
      case 'register':
        return (
          <RegisterForm
            onRegister={handleRegister}
            onNavigateToLogin={() => setCurrentPage('login')}
          />
        );
      
      case 'dashboard':
        return (
          <>
            {profile?.role === 'admin' && user?.email === 'masterlink@acesso.com' ? (
              <AdminDashboard
                user={profile}
                onLogout={signOut}
                isOnline={true}
                onForceRefresh={forceRefresh}
              />
            ) : (
              <Dashboard
                user={profile}
                trackingSessions={sessions}
                onCreateSession={handleCreateSession}
                onLogout={signOut}
                onSelectSession={handleSelectSession}
                onStopTracking={handleStopTracking}
                onDeleteSession={deleteSession}
                onStartGPSTracking={handleStartGPSTracking}
                onStartGPSMap={handleStartGPSMap}
                isOnline={true}
                onForceRefresh={forceRefresh}
              />
            )}
          </>
        );
      
      case 'consent':
        return (
          <ConsentPage
            inviteToken={inviteToken}
            invite={invite}
            loading={inviteLoading}
            error={inviteError}
            onAccept={handleAcceptTracking}
            onReject={handleRejectTracking}
            onNavigateToLogin={() => setCurrentPage('login')}
            onNavigateToRegister={() => setCurrentPage('register')}
          />
        );
      
      case 'location-viewer':
        return (
          <LocationViewer
            session={selectedSession}
            locations={locations[selectedSession?.id] || []}
            onBack={() => setCurrentPage('dashboard')}
            isOnline={true}
          />
        );

      case 'gps-tracker':
        return (
          <GPSTracker
            session={selectedSession}
            locations={locations[selectedSession?.id] || []}
            onBack={() => setCurrentPage('dashboard')}
            onRefresh={() => {
              if (selectedSession) {
                loadLocations(selectedSession.id);
              }
            }}
            isOnline={true}
          />
        );

      case 'gps-map':
        return (
          <GPSMapTracker
            session={selectedSession}
            locations={locations[selectedSession?.id] || []}
            onBack={() => setCurrentPage('dashboard')}
            onRefresh={() => {
              if (selectedSession) {
                loadLocations(selectedSession.id);
              }
            }}
            isOnline={true}
            onLocationUpdate={(location) => {
              console.log(' Nova localização recebida:', location);
              // Aqui você pode processar a localização se necessário
            }}
            onNotification={addNotification}
          />
        );

      case 'tracking-active':
        return (
          <TrackingActive
            onStop={() => handleStopTracking()}
            isOnline={true}
            adminName={invite?.admin_name}
            tokenAccepted={inviteToken ? acceptedTokens.has(inviteToken) : false}
            sessionId={invite?.session_id}
          />
        );
      
      default:
        return (
          <LoginForm
            onLogin={handleLogin}
            onNavigateToRegister={() => setCurrentPage('register')}
          />
        );
    }
  };

  return (
    <div className="App">
      {/* Notification System */}
      {(currentPage === 'dashboard' || currentPage === 'location-viewer' || currentPage === 'gps-tracker' || currentPage === 'gps-map') && (
        <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative bg-white rounded-full p-2 sm:p-3 shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            type="button"
          >
            <Bell className="w-4 h-4 sm:w-6 sm:h-6 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto z-50">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Notificações</h3>
                {notifications.length > 0 && (
                  <button
                    onClick={clearNotifications}
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    type="button"
                  >
                    Limpar Todas
                  </button>
                )}
              </div>
              
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Nenhuma notificação</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {notifications.slice(0, 10).map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => markAsRead(notification.id)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors select-none ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1 break-words">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {notification.timestamp.toLocaleTimeString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Overlay para fechar notificações clicando fora */}
          {showNotifications && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowNotifications(false)}
            />
          )}
        </div>
      )}
      
      {renderCurrentPage()}
    </div>
  );
}

export default App;