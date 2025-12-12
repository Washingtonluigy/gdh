import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Inicializando Supabase...');
console.log(' URL:', supabaseUrl ? 'Definida' : 'UNDEFINED');
console.log('🔑 Key:', supabaseAnonKey ? 'Definida' : 'UNDEFINED');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variáveis de ambiente do Supabase não encontradas!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey);
  throw new Error('Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file');
}

let supabase: any = null;

try {
  console.log('Criando...iente Supabase...');
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
        heartbeatIntervalMs: 30000,
        reconnectAfterMs: 1000
      }
    }
  });
  console.log('Cliente Supabase criado com sucesso!');
} catch (error) {
  console.error('Erro ao criar cliente Supabase:', error);
  throw new Error(`Failed to create Supabase client: ${error}`);
}

export { supabase };

// Types for our database
export interface Profile {
  id: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'vendor';
  created_at?: string;
  allowed_sessions?: number;
  is_blocked?: boolean;
}

export interface TrackingSession {
  id: string;
  admin_id: string;
  tracked_user_name: string;
  tracked_user_phone?: string;
  tracked_user_id?: string;
  invite_token: string;
  status: 'pending' | 'active' | 'inactive';
  created_at: string;
  accepted_at?: string;
  expires_at: string;
  last_location_update?: string;
}

export interface Location {
  id: string;
  session_id: string;
  user_id?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  address?: string;
  created_at: string;
  synced?: boolean;
}

// Interface para dados de usuários (admin)
export interface UserData {
  id: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'vendor';
  allowed_sessions: number;
  is_blocked: boolean;
  created_at: string;
  active_sessions_count: number;
  total_sessions_count: number;
}

// Interface para vouchers
export interface VoucherStats {
  total_vouchers: number;
  used_vouchers: number;
  unused_vouchers: number;
  recent_vouchers: Array<{
    code: string;
    is_used: boolean;
    used_by?: string;
    used_at?: string;
    created_at: string;
  }>;
}

// API functions
export const trackingAPI = {
  // Create new tracking session
  async createSession(trackedUserName: string, trackedUserPhone?: string) {
    console.log('📡 Creating session:', { trackedUserName, trackedUserPhone });
    
    const { data, error } = await supabase.rpc('create_tracking_session', {
      p_tracked_user_name: trackedUserName,
      p_tracked_user_phone: trackedUserPhone || null
    });
    
    if (error) {
      console.error('Error creating session:', error);
      throw new Error(`Error creating session: ${error.message}`);
    }
    
    console.log('Session created:', data);
    return data;
  },

  // Accept tracking invite
  async acceptInvite(token: string) {
    console.log('📡 Accepting invite:', token);
    
    // Verificar se o cliente Supabase está disponível
    if (!supabase) {
      console.error('Cliente Supabase não está disponível!');
      throw new Error('Sistema não inicializado corretamente. Recarregue a página.');
    }
    
    try {
      console.log('📡 Aceitando convite de forma anônima...');
      
      // Get session info first to validate token
      const sessionResult = await this.getSessionByToken(token);
      if (!sessionResult.success) {
        throw new Error(sessionResult.error || 'Convite não encontrado ou expirado');
      }
      
      const sessionData = sessionResult.session;
      if (!sessionData) {
        throw new Error('Convite não encontrado ou já foi aceito. Verifique se o link ainda é válido.');
      }
      
      // Verificar se a sessão ainda está pendente
      if (sessionData.status !== 'pending') {
        if (sessionData.status === 'active') {
          throw new Error('Este convite já foi aceito anteriormente.');
        } else {
          throw new Error('Este convite não está mais disponível.');
        }
      }
      
      // Update session status directly without creating a profile
      const { data, error } = await supabase
        .from('tracking_sessions')
        .update({ 
          status: 'active',
          accepted_at: new Date().toISOString(),
          last_location_update: new Date().toISOString()
        })
        .eq('id', sessionData.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating session status:', error);
        throw new Error(`Erro ao ativar rastreamento: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('Sessão não encontrada ou já foi processada.');
      }
      
      console.log('Convite aceito com sucesso:', data);
      return {
        success: true,
        message: 'Rastreamento aceito com sucesso!',
        session_id: data.id,
        session: data
      };
      
    } catch (error) {
      console.error('Error in acceptInvite:', error);
      throw error;
    }
  },

  // Get session by token
  async getSessionByToken(token: string) {
    console.log('📡 Getting session by token:', token);
    
    // Verificar se o cliente Supabase está disponível
    if (!supabase) {
      console.error('Cliente Supabase não está disponível!');
      throw new Error('Sistema não inicializado corretamente. Recarregue a página.');
    }
    
    const { data, error } = await supabase.rpc('get_session_by_token', {
      p_token: token
    });
    
    if (error) {
      console.error('Error getting session:', error);
      throw new Error(`Error getting session: ${error.message}`);
    }
    
    console.log('Session found:', data);
    return data;
  },

  // Insert location
  async insertLocation(sessionId: string, locationData: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
    heading?: number;
    speed?: number;
    address?: string;
  }) {
    console.log('📡 Inserting location:', { sessionId, locationData });
    
    // Verificar se o cliente Supabase está disponível
    if (!supabase) {
      console.error('Cliente Supabase não está disponível!');
      throw new Error('Sistema não inicializado corretamente. Recarregue a página.');
    }
    
    const { data, error } = await supabase.rpc('insert_location', {
      p_session_id: sessionId,
      p_latitude: locationData.latitude,
      p_longitude: locationData.longitude,
      p_accuracy: locationData.accuracy,
      p_altitude: locationData.altitude,
      p_heading: locationData.heading,
      p_speed: locationData.speed,
      p_address: locationData.address
    });
    
    if (error) {
      console.error('Error inserting location:', error);
      throw new Error(`Error saving location: ${error.message}`);
    }
    
    console.log('Location inserted:', data);
    return data;
  },

  // Sync existing users - create profiles for users without profiles
  async syncExistingUsers() {
    console.log('📡 Syncing existing users...');
    
    try {
      // Get all tracking sessions to find users who created sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('tracking_sessions')
        .select('admin_id')
        .not('admin_id', 'is', null);
      
      if (sessionsError) {
        console.error('Error getting sessions:', sessionsError);
        return { success: false, error: sessionsError.message };
      }
      
      // Get unique admin IDs (these are user IDs who created sessions)
      const userIds = [...new Set(sessions?.map(s => s.admin_id) || [])];
      console.log('👥 Found user IDs from sessions:', userIds.length);
      
      if (userIds.length === 0) {
        return { success: true, message: 'Nenhum usuário encontrado para sincronizar', synced: 0 };
      }
      
      // Check which users don't have profiles
      const { data: existingProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .in('id', userIds);
      
      if (profilesError) {
        console.error('Error getting existing profiles:', profilesError);
        return { success: false, error: profilesError.message };
      }
      
      const existingProfileIds = existingProfiles?.map(p => p.id) || [];
      const missingProfileIds = userIds.filter(id => !existingProfileIds.includes(id));
      
      console.log('🔍 Users without profiles:', missingProfileIds.length);
      
      if (missingProfileIds.length === 0) {
        return { success: true, message: 'Todos os usuários já têm perfis', synced: 0 };
      }
      
      // Create profiles for missing users
      const profilesToCreate = missingProfileIds.map(userId => ({
        id: userId,
        full_name: `Cliente ${userId.substring(0, 8)}`, // Fallback name
        phone: '',
        role: 'vendor',
        allowed_sessions: 2,
        is_blocked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      console.log('📝 Creating profiles for users:', profilesToCreate.length);
      
      const { data: createdProfiles, error: createError } = await supabase
        .from('profiles')
        .insert(profilesToCreate)
        .select();
      
      if (createError) {
        console.error('Error creating profiles:', createError);
        return { success: false, error: createError.message };
      }
      
      console.log('Profiles created:', createdProfiles?.length || 0);
      
      return {
        success: true,
        message: `${createdProfiles?.length || 0} perfis criados com sucesso!`,
        synced: createdProfiles?.length || 0
      };
      
    } catch (error) {
      console.error('Error in syncExistingUsers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  },

  // Get session locations
  async getSessionLocations(sessionId: string, limit = 100) {
    console.log('📡 Getting session locations:', { sessionId, limit });
    
    const { data, error } = await supabase.rpc('get_session_locations', {
      p_session_id: sessionId,
      p_limit: limit
    });
    
    if (error) {
      console.error('Error getting locations:', error);
      throw new Error(`Error getting locations: ${error.message}`);
    }
    
    console.log('Locations found:', data?.locations?.length || 0);
    return data || { success: true, locations: [] };
  },

  // Get user sessions
  async getUserSessions() {
    console.log('📡 Getting user sessions...');
    
    const { data, error } = await supabase
      .from('tracking_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error getting sessions:', error);
      throw new Error(`Error getting sessions: ${error.message}`);
    }
    
    console.log('Sessions found:', data?.length || 0);
    return data || [];
  },

  // Admin functions
  async generateVoucher(count: number = 1) {
    console.log('📡 Generating vouchers:', count);
    
    try {
      // Generate voucher codes
      const vouchers = [];
      const voucherCodes = [];
      
      for (let i = 0; i < count; i++) {
        // Generate 8-character alphanumeric code
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        vouchers.push({
          code: code,
          is_used: false,
          created_at: new Date().toISOString()
        });
        voucherCodes.push(code);
      }
      
      console.log('🎫 Generated voucher codes:', voucherCodes);
      
      // Insert vouchers into database
      const { data, error } = await supabase
        .from('vouchers')
        .insert(vouchers)
        .select();
      
      if (error) {
        console.error('Error inserting vouchers:', error);
        throw new Error(`Error creating vouchers: ${error.message}`);
      }
      
      console.log('Vouchers created in database:', data);
      
      return {
        success: true,
        count: count,
        voucher_codes: voucherCodes,
        message: `${count} voucher(s) gerado(s) com sucesso!`
      };
      
    } catch (error) {
      console.error('Error generating vouchers:', error);
      throw error;
    }
  },

  async redeemVoucher(voucherCode: string) {
    console.log('📡 Redeeming voucher:', voucherCode);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      console.log('👤 Current user:', user.id);

      // Check if voucher exists and get its status
      const { data: voucher, error: voucherError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('code', voucherCode.toUpperCase())
        .single();

      console.log('🎫 Voucher query result:', { voucher, voucherError });

      if (voucherError) {
        if (voucherError.code === 'PGRST116') {
          throw new Error('Voucher não encontrado. Verifique se o código está correto.');
        }
        throw new Error(`Erro ao buscar voucher: ${voucherError.message}`);
      }

      if (!voucher) {
        throw new Error('Voucher não encontrado. Verifique se o código está correto.');
      }

      if (voucher.is_used) {
        throw new Error('Este voucher já foi usado anteriormente.');
      }

      console.log('Voucher válido encontrado:', voucher.code);

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('👤 User profile:', { profile, profileError });

      if (profileError || !profile) {
        throw new Error('Perfil do usuário não encontrado');
      }

      console.log('Updating voucher as used...');

      // Update voucher as used in a transaction-like approach
      const { error: updateVoucherError } = await supabase
        .from('vouchers')
        .update({
          is_used: true,
          used_by_user_id: user.id,
          used_at: new Date().toISOString()
        })
        .eq('id', voucher.id)
        .eq('is_used', false); // Only update if still unused

      if (updateVoucherError) {
        console.error('Error updating voucher:', updateVoucherError);
        throw new Error('Erro ao processar voucher. Pode ter sido usado por outro usuário simultaneamente.');
      }

      console.log('Voucher marked as used');

      // Update user's allowed sessions
      const newAllowedSessions = (profile.allowed_sessions || 2) + 1;
      
      console.log('Updating user sessions:', { current: profile.allowed_sessions, new: newAllowedSessions });
      
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ 
          allowed_sessions: newAllowedSessions
        })
        .eq('id', user.id);

      if (updateProfileError) {
        console.error('Error updating profile, rolling back voucher:', updateProfileError);
        
        // Rollback voucher if profile update fails
        await supabase
          .from('vouchers')
          .update({
            is_used: false,
            used_by_user_id: null,
            used_at: null
          })
          .eq('id', voucher.id);
        
        throw new Error('Erro ao atualizar perfil do usuário');
      }

      console.log('Voucher redeemed successfully:', {
        voucherCode,
        userId: user.id,
        newAllowedSessions
      });
      
      return {
        success: true,
        message: `Voucher resgatado com sucesso! Agora você pode criar ${newAllowedSessions} rastreamentos.`,
        new_allowed_sessions: newAllowedSessions
      };

    } catch (error) {
      console.error('Error redeeming voucher:', error);
      
      // Return more specific error messages
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('Erro desconhecido ao resgatar voucher');
      }
    }
  },

  async getVoucherStats(): Promise<VoucherStats> {
    console.log('📡 Getting voucher stats...');
    
    try {
      // Get total vouchers count
      const { count: totalCount, error: totalError } = await supabase
        .from('vouchers')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Get used vouchers count
      const { count: usedCount, error: usedError } = await supabase
        .from('vouchers')
        .select('*', { count: 'exact', head: true })
        .eq('is_used', true);

      if (usedError) throw usedError;

      // Get recent vouchers (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentVouchers, error: recentError } = await supabase
        .from('vouchers')
        .select(`
          code,
          is_used,
          used_at,
          created_at,
          profiles!vouchers_used_by_user_id_fkey(full_name)
        `)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (recentError) throw recentError;

      const stats: VoucherStats = {
        total_vouchers: totalCount || 0,
        used_vouchers: usedCount || 0,
        unused_vouchers: (totalCount || 0) - (usedCount || 0),
        recent_vouchers: (recentVouchers || []).map(v => ({
          code: v.code,
          is_used: v.is_used,
          used_by: v.profiles?.full_name || null,
          used_at: v.used_at,
          created_at: v.created_at
        }))
      };

      console.log('Voucher stats loaded:', stats);
      return stats;

    } catch (error) {
      console.error('Error getting voucher stats:', error);
      throw new Error(`Error getting voucher stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async getAllUserProfiles(): Promise<UserData[]> {
    console.log('📡 Getting all user profiles...');
    
    try {
      // Get all profiles excluding admin users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          phone,
          role,
          created_at,
          allowed_sessions,
          is_blocked
        `)
        .neq('role', 'admin')
        .order('created_at', { ascending: false });
      
      if (profilesError) {
        console.error('Error getting user profiles:', profilesError);
        return [];
      }
      
      const users: UserData[] = (profiles || []).map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        phone: profile.phone || '',
        role: profile.role,
        allowed_sessions: profile.allowed_sessions || 2,
        is_blocked: profile.is_blocked || false,
        created_at: profile.created_at,
        active_sessions_count: 0,
        total_sessions_count: 0
      }));

      // Get session counts for each user
      for (const user of users) {
        try {
          const { data: sessions, error: sessionsError } = await supabase
            .from('tracking_sessions')
            .select('id, status')
            .eq('admin_id', user.id);

          if (!sessionsError && sessions) {
            user.total_sessions_count = sessions.length;
            user.active_sessions_count = sessions.filter(s => s.status === 'active').length;
          }
        } catch (err) {
          console.warn('Warning: Could not get session counts for user', user.id);
        }
      }
      
      console.log('User profiles loaded:', users.length);
      return users;
      
    } catch (error) {
      console.error('Error in getAllUserProfiles:', error);
      return [];
    }
  },


  async blockUserAccess(userId: string, blockStatus: boolean) {
    console.log('📡 Blocking/unblocking user:', userId, blockStatus);
    
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_blocked: blockStatus })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error blocking user:', error);
      throw new Error(`Error blocking user: ${error.message}`);
    }
    
    console.log('User access updated:', data);
    return {
      success: true,
      message: blockStatus ? 'Usuário bloqueado com sucesso' : 'Usuário desbloqueado com sucesso'
    };
  },

  // Simple admin check without RPC
  async checkAdminUserExists() {
    console.log('📡 Checking if admin user exists...');
    
    try {
      // Check if admin profile exists
      const { data: adminProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error checking admin profile:', profileError);
        return [{
          user_exists: false,
          profile_exists: false,
          user_email: 'masterlink@acesso.com',
          profile_role: null,
          allowed_sessions: 0
        }];
      }
      
      const result = [{
        user_exists: true,
        profile_exists: !!adminProfile,
        user_email: 'masterlink@acesso.com',
        profile_role: adminProfile?.role || null,
        allowed_sessions: adminProfile?.allowed_sessions || 999
      }];
      
      console.log('Admin check result:', result);
      return result;
      
    } catch (error) {
      console.error('Error in checkAdminUserExists:', error);
      return [{
        user_exists: false,
        profile_exists: false,
        user_email: 'masterlink@acesso.com',
        profile_role: null,
        allowed_sessions: 0
      }];
    }
  }
};

// Real-time subscriptions
export const realtimeSubscriptions = {
  // Subscribe to location changes
  subscribeToLocations(sessionId: string, callback: (location: Location) => void) {
    console.log('📡 Subscribing to locations for session:', sessionId);
    
    return supabase
      .channel(`locations:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'locations',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log(' New location received:', payload.new);
          callback(payload.new as Location);
        }
      )
      .subscribe();
  },

  // Subscribe to session status changes
  subscribeToSessionStatus(callback: (session: TrackingSession) => void) {
    console.log('📡 Subscribing to session status changes...');
    
    return supabase
      .channel('session_status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tracking_sessions'
        },
        (payload) => {
          console.log('Session status changed:', payload.new);
          callback(payload.new as TrackingSession);
        }
      )
      .subscribe();
  }
};