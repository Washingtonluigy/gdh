import { useState, useEffect, useCallback } from 'react';
import { supabase, TrackingSession, Location, trackingAPI, realtimeSubscriptions } from '../lib/supabase';
import { useAuth } from './useAuth';

export const useTracking = () => {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<TrackingSession[]>([]);
  const [locations, setLocations] = useState<{ [sessionId: string]: Location[] }>({});
  const [loading, setLoading] = useState(false);

  // Load tracking sessions
  const loadSessions = useCallback(async () => {
    if (!user || !profile) {
      console.log('User or profile not available for loading sessions');
      return;
    }

    try {
      setLoading(true);
      console.log('📡 Loading tracking sessions...');
      const data = await trackingAPI.getUserSessions();
      console.log('Sessions loaded:', data.length);
      setSessions(data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  // Load locations for a session
  const loadLocations = useCallback(async (sessionId: string) => {
    try {
      console.log(' Loading locations for session:', sessionId);
      const result = await trackingAPI.getSessionLocations(sessionId);
      
      if (result && result.success === true) {
        const loadedLocations = result.locations || [];
        console.log('Locations loaded:', loadedLocations.length);
        setLocations(prev => ({
          ...prev,
          [sessionId]: loadedLocations
        }));
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  }, []);

  // Create new tracking session
  const createSession = async (trackedUserName: string, trackedUserPhone?: string) => {
    if (!user || !profile) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Creating new tracking session:', { trackedUserName, trackedUserPhone });
      
      const data = await trackingAPI.createSession(trackedUserName, trackedUserPhone);
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error creating session');
      }
      
      // Reload sessions
      await loadSessions();
      
      return data;
    } catch (error) {
      console.error('Error creating session:', error);
      throw new Error(`Error creating tracking session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Accept tracking invite
  const acceptInvite = async (token: string) => {
    try {
      console.log(' Accepting tracking invite:', token);
      
      const data = await trackingAPI.acceptInvite(token);
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error accepting invite');
      }
      
      console.log('Invite accepted successfully');
      return data;
    } catch (error) {
      console.error('Error accepting invite:', error);
      throw error;
    }
  };

  // Start location tracking
  const startLocationTracking = (sessionId: string) => {
    console.log('🛰️ Starting GPS tracking for session:', sessionId);

    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 5000
    };

    const generateLocation = async (position?: GeolocationPosition) => {
      let locationData;
      
      if (position) {
        // Use real GPS data
        const { coords } = position;
        locationData = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          altitude: coords.altitude,
          heading: coords.heading,
          speed: coords.speed,
          address: `GPS: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
        };

        console.log(' New real GPS location:', locationData);
      } else {
        // Use mock data for demo
        locationData = {
          latitude: -23.550520 + (Math.random() - 0.5) * 0.001,
          longitude: -46.633309 + (Math.random() - 0.5) * 0.001,
          accuracy: Math.random() * 10 + 5,
          address: 'Centro, São Paulo - SP'
        };

        console.log(' New mock location:', locationData);
      }

      try {
        const result = await trackingAPI.insertLocation(sessionId, locationData);
        if (result.success) {
          console.log('Location saved to Supabase');
        }
      } catch (error) {
        console.error('Error saving location:', error);
      }
    };

    // Generate initial location
    generateLocation();

    // Start GPS tracking
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        console.log('📡 New GPS position received:', position.coords);
        generateLocation(position);
      },
      (error) => {
        console.error('Geolocation error:', error);
        // Fallback to mock data
        generateLocation();
      },
      options
    );
    
    console.log('GPS watch started with ID:', watchId);
    return watchId;
  };

  // Stop location tracking
  const stopLocationTracking = (watchId: number) => {
    console.log('Parar Stopping GPS tracking:', watchId);
    navigator.geolocation.clearWatch(watchId);
    console.log('GPS tracking stopped');
  };

  // Update session status
  const updateSessionStatus = async (sessionId: string, status: TrackingSession['status']) => {
    try {
      console.log('Updating session status:', sessionId, 'to:', status);

      const { error } = await supabase
        .from('tracking_sessions')
        .update({ status })
        .eq('id', sessionId);

      if (error) throw error;
      
      console.log('Status updated in Supabase');
      
      // Reload sessions
      await loadSessions();
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  };

  // Delete session
  const deleteSession = async (sessionId: string) => {
    try {
      console.log('Excluir Deleting session:', sessionId);

      const { error } = await supabase
        .from('tracking_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      
      console.log('Session deleted from Supabase');
      
      // Remove from local state
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setLocations(prev => {
        const newLocations = { ...prev };
        delete newLocations[sessionId];
        return newLocations;
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  };

  // Get session by token
  const getSessionByToken = async (token: string) => {
    try {
      console.log('🔍 Getting session by token:', token);
      const result = await trackingAPI.getSessionByToken(token);
      
      if (!result.success) {
        throw new Error(result.error || 'Session not found');
      }
      
      console.log('Session found:', result.session);
      return result.session;
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  };

  // Force refresh
  const forceRefresh = useCallback(() => {
    console.log('Force refreshing sessions...');
    if (user && profile) {
      loadSessions();
    }
  }, [user, profile, loadSessions]);

  // Add a separate effect to handle location subscriptions when sessions change
  useEffect(() => {
    if (!user || !profile || profile.role !== 'admin') return;

    console.log(' Setting up location subscriptions for sessions...');
    const locationSubscriptions: any[] = [];
    
    sessions.forEach(session => {
      if (session.status === 'active') {
        const subscription = realtimeSubscriptions.subscribeToLocations(
          session.id,
          (newLocation) => {
            console.log(' New location received via realtime:', newLocation);
            setLocations(prev => ({
              ...prev,
              [newLocation.session_id]: [
                ...(prev[newLocation.session_id] || []),
                newLocation
              ]
            }));
          }
        );
        locationSubscriptions.push(subscription);
      }
    });

    return () => {
      console.log('🔌 Disconnecting location subscriptions...');
      locationSubscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [sessions, user, profile]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user || !profile) return;

    console.log('📡 Setting up real-time subscriptions...');

    // Subscribe to session status changes
    const sessionSubscription = realtimeSubscriptions.subscribeToSessionStatus(() => {
      console.log('Session status changed, reloading...');
      loadSessions();
    });

    // Subscribe to location updates for admin users
    const locationSubscriptions: any[] = [];
    
    if (profile.role === 'admin') {
      sessions.forEach(session => {
        const subscription = realtimeSubscriptions.subscribeToLocations(
          session.id,
          (newLocation) => {
            console.log(' New location received via realtime:', newLocation);
            setLocations(prev => ({
              ...prev,
              [newLocation.session_id]: [
                ...(prev[newLocation.session_id] || []),
                newLocation
              ]
            }));
          }
        );
        locationSubscriptions.push(subscription);
      });
    }

    return () => {
      console.log('🔌 Disconnecting subscriptions...');
      sessionSubscription.unsubscribe();
      locationSubscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [user, profile, loadSessions]);

  // Load initial data
  useEffect(() => {
    if (user && profile) {
      console.log('Loading initial data...');
      loadSessions();
    }
  }, [user, profile, loadSessions]);

  return {
    sessions,
    locations,
    loading,
    isOnline: true, // Always online with Supabase
    forceRefresh,
    createSession,
    acceptInvite,
    startLocationTracking,
    stopLocationTracking,
    updateSessionStatus,
    deleteSession,
    loadLocations,
    getSessionByToken
  };
};