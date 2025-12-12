import { useState, useEffect } from 'react';
import { AppState, User, TrackingSession, Location } from '../types';

// Simulação de dados persistentes (em produção seria um banco de dados)
const STORAGE_KEY = 'rastreia_familia_data';

const loadFromStorage = (): Partial<AppState> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveToStorage = (data: Partial<AppState>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
  }
};

const initialState: AppState = {
  currentUser: null,
  trackingSessions: [],
  locations: {},
  isAuthenticated: false,
  currentPage: 'login',
  selectedSession: null,
  inviteToken: null,
};

export const useAppState = () => {
  const [state, setState] = useState<AppState>(initialState);

  // Carregar dados salvos ao inicializar
  useEffect(() => {
    const savedData = loadFromStorage();
    if (savedData.trackingSessions || savedData.locations) {
      setState(prev => ({
        ...prev,
        trackingSessions: savedData.trackingSessions || [],
        locations: savedData.locations || {},
      }));
    }
  }, []);

  // Salvar dados sempre que houver mudanças
  useEffect(() => {
    if (state.trackingSessions.length > 0 || Object.keys(state.locations).length > 0) {
      saveToStorage({
        trackingSessions: state.trackingSessions,
        locations: state.locations,
      });
    }
  }, [state.trackingSessions, state.locations]);

  const login = (email: string, password: string) => {
    // Simular autenticação
    const user: User = {
      id: '1',
      name: 'João Silva',
      email,
      phone: '(11) 99999-9999',
      role: 'admin',
      createdAt: new Date(),
    };
    
    setState(prev => ({
      ...prev,
      currentUser: user,
      isAuthenticated: true,
      currentPage: 'dashboard',
    }));
  };

  const register = (userData: Omit<User, 'id' | 'createdAt'>) => {
    const user: User = {
      ...userData,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    
    setState(prev => ({
      ...prev,
      currentUser: user,
      isAuthenticated: true,
      currentPage: 'dashboard',
    }));
  };

  const logout = () => {
    setState(initialState);
  };

  const createTrackingSession = (trackedUserName: string, trackedUserPhone: string) => {
    const sessionId = Date.now().toString();
    const inviteLink = `${window.location.origin}?token=tracking-${sessionId}`;
    
    const session: TrackingSession = {
      id: sessionId,
      adminId: state.currentUser!.id,
      trackedUserId: '',
      trackedUserName,
      trackedUserPhone,
      inviteLink,
      status: 'pending',
      createdAt: new Date(),
    };

    setState(prev => ({
      ...prev,
      trackingSessions: [...prev.trackingSessions, session],
    }));

    return session;
  };

  const acceptTracking = (sessionId: string) => {
    setState(prev => ({
      ...prev,
      trackingSessions: prev.trackingSessions.map(session =>
        session.id === sessionId
          ? { ...session, status: 'active' as const, acceptedAt: new Date() }
          : session
      ),
    }));

    // Simular localização em tempo real
    startLocationTracking(sessionId);
    
    // Mostrar mensagem de sucesso
    alert('Rastreamento aceito com sucesso!\n\nO sistema já está coletando sua localização. Você pode fechar esta página.');
    
    // Redirecionar após um tempo
    setTimeout(() => {
      setState(prev => ({ ...prev, currentPage: 'tracking-active' }));
    }, 3000);
  };

  const startLocationTracking = (sessionId: string) => {
    // Localizações simuladas mais realistas (diferentes bairros de São Paulo)
    const locations = [
      { lat: -23.550520, lng: -46.633309, address: 'Centro, São Paulo - SP' },
      { lat: -23.561414, lng: -46.656166, address: 'Vila Madalena, São Paulo - SP' },
      { lat: -23.574320, lng: -46.648521, address: 'Jardins, São Paulo - SP' },
      { lat: -23.533773, lng: -46.625290, address: 'Santana, São Paulo - SP' },
      { lat: -23.596319, lng: -46.682489, address: 'Vila Olímpia, São Paulo - SP' },
      { lat: -23.547054, lng: -46.636489, address: 'República, São Paulo - SP' },
      { lat: -23.563210, lng: -46.654321, address: 'Pinheiros, São Paulo - SP' },
    ];

    let currentLocationIndex = 0;
    let baseLocation = locations[0];

    const generateRealisticLocation = () => {
      // Simular movimento mais realístico
      const variation = 0.002; // Variação menor para movimento mais realista
      const location: Location = {
        latitude: baseLocation.lat + (Math.random() - 0.5) * variation,
        longitude: baseLocation.lng + (Math.random() - 0.5) * variation,
        timestamp: new Date(),
        accuracy: Math.random() * 15 + 3, // Precisão entre 3-18 metros
        address: baseLocation.address,
      };

      setState(prev => ({
        ...prev,
        locations: {
          ...prev.locations,
          [sessionId]: [...(prev.locations[sessionId] || []), location],
        },
      }));

      // Ocasionalmente mudar para uma nova localização
      if (Math.random() < 0.1) { // 10% de chance de mudar de local
        currentLocationIndex = (currentLocationIndex + 1) % locations.length;
        baseLocation = locations[currentLocationIndex];
      }
    };

    // Gerar localização inicial
    generateRealisticLocation();

    // Continuar gerando localizações a cada 10 segundos
    const interval = setInterval(generateRealisticLocation, 10000);

    // Salvar referência do intervalo para poder parar depois
    return interval;
  };

  const stopTracking = (sessionId: string) => {
    setState(prev => ({
      ...prev,
      trackingSessions: prev.trackingSessions.map(session =>
        session.id === sessionId
          ? { ...session, status: 'inactive' as const }
          : session
      ),
    }));
  };

  const deleteSession = (sessionId: string) => {
    setState(prev => {
      const newLocations = { ...prev.locations };
      delete newLocations[sessionId];
      
      return {
        ...prev,
        trackingSessions: prev.trackingSessions.filter(session => session.id !== sessionId),
        locations: newLocations,
      };
    });
  };

  const clearLocationHistory = (sessionId: string) => {
    setState(prev => ({
      ...prev,
      locations: {
        ...prev.locations,
        [sessionId]: [],
      },
    }));
  };

  const navigateTo = (page: AppState['currentPage']) => {
    setState(prev => ({ ...prev, currentPage: page }));
  };

  const selectSession = (session: TrackingSession | null) => {
    setState(prev => ({ ...prev, selectedSession: session }));
  };

  const setInviteToken = (token: string | null) => {
    setState(prev => ({ ...prev, inviteToken: token }));
  };

  return {
    state,
    actions: {
      login,
      register,
      logout,
      createTrackingSession,
      acceptTracking,
      navigateTo,
      selectSession,
      setInviteToken,
      stopTracking,
      deleteSession,
      clearLocationHistory,
    },
  };
};