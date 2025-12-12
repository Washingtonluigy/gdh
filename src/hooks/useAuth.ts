import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setLoading(false);
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('🔐 Auth state changed:', event, session?.user?.email, 'Event:', event);
            setSession(session);
            setUser(session?.user ?? null);
            
            if (session?.user) {
              console.log('👤 Usuário logado, carregando/criando perfil...');
              await loadProfile(session.user.id);
            } else {
              console.log('👤 Usuário deslogado, limpando perfil...');
              setProfile(null);
              setLoading(false);
            }
          }
        );

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      console.log('📡 Carregando perfil para usuário:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, created_at, allowed_sessions, is_blocked')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar perfil:', error);
      } else if (data) {
        console.log('Perfil carregado:', data);
        setProfile(data);
      } else {
        console.log('Perfil não encontrado, criando...');
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
          await ensureProfileExists(user);
        } else {
          console.error('Usuário não encontrado para criar perfil');
        }
      }
    } catch (error) {
      console.error('Erro geral ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const ensureProfileExists = async (user: User) => {
    try {
      console.log('🔐 Verificando/criando perfil para:', user.email);
      
      // Primeiro, verificar se o perfil já existe
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing profile:', checkError);
        return;
      }
      
      if (existingProfile) {
        console.log('Perfil já existe:', existingProfile);
        setProfile(existingProfile);
        return;
      }
      
      // Se não existe, criar novo perfil
      const isAdminUser = user.email === 'masterlink@acesso.com';
      const userRole = isAdminUser ? 'admin' : 'vendor';
      
      console.log('🆕 Criando novo perfil para:', user.email, 'Role:', userRole);
      
      const profileData = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
        phone: user.user_metadata?.phone || '',
        role: userRole,
        allowed_sessions: isAdminUser ? 999 : 2,
        is_blocked: false,
        updated_at: new Date().toISOString()
      };
      
      console.log('📝 Dados do perfil a ser criado:', profileData);
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      if (createError) {
        console.error('Erro ao criar perfil:', createError);
        // Tentar novamente com dados mínimos
        const minimalProfile = {
          id: user.id,
          full_name: user.email?.split('@')[0] || 'Usuário',
          role: userRole,
          allowed_sessions: isAdminUser ? 999 : 2,
          is_blocked: false,
          updated_at: new Date().toISOString()
        };
        
        const { data: retryProfile, error: retryError } = await supabase
          .from('profiles')
          .insert(minimalProfile)
          .select()
          .single();
          
        if (retryError) {
          console.error('Erro na segunda tentativa:', retryError);
        } else if (retryProfile) {
          console.log('Perfil criado na segunda tentativa:', retryProfile);
          setProfile(retryProfile);
        }
      } else if (newProfile) {
        console.log('Perfil criado com sucesso:', newProfile);
        setProfile(newProfile);
      }
    } catch (error) {
      console.error('Erro geral ao garantir perfil:', error);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'vendor', // Todos os usuários que se registram são clientes
            phone: phone || ''
          }
        }
      });

      if (error) {
        console.error('SignUp error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('SignUp catch error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Se for o email do admin e falhar o login, tenta criar o usuário primeiro
      if (email === 'masterlink@acesso.com') {
        try {
          // Tenta fazer login primeiro
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (!error) {
            return { data, error: null };
          }
          
          // Se falhou por credenciais inválidas, tenta criar o usuário
          if (error.message === 'Invalid login credentials') {
            console.log('Admin não encontrado, criando usuário...');
            
            // Cria o usuário admin
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  full_name: 'Administrador Master',
                  role: 'admin',
                  phone: ''
                }
              }
            });
            
            if (signUpError) {
              throw signUpError;
            }
            
            // Se o usuário foi criado com sucesso, tenta fazer login novamente
            if (signUpData.user) {
              const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              
              if (loginError) {
                throw loginError;
              }
              
              return { data: loginData, error: null };
            }
          }
          
          throw error;
        } catch (adminError) {
          console.error('Erro ao criar/fazer login do admin:', adminError);
          throw adminError;
        }
      }
      
      // Para outros usuários, faz login normal
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('SignIn error:', error);
        return { data, error };
      }

      return { data, error };
    } catch (error) {
      console.error('SignIn catch error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  };

  return {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut
  };
};