import { useState, useEffect } from 'react';
import { trackingAPI } from '../lib/supabase';

interface TrackingInvite {
  id: string;
  tracked_user_name: string;
  tracked_user_phone?: string;
  status: 'pending' | 'active' | 'inactive';
  created_at: string;
  expires_at: string;
  admin_name?: string;
}

export const useInvite = (token: string | null) => {
  const [invite, setInvite] = useState<TrackingInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    console.log('🔍 Loading invite for token:', token);

    const loadInvite = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await trackingAPI.getSessionByToken(token);
        console.log('Invite data loaded:', result);
        
        if (result.success && result.session) {
          setInvite({
            id: result.session.id,
            tracked_user_name: result.session.tracked_user_name,
            tracked_user_phone: result.session.tracked_user_phone,
            status: result.session.status,
            created_at: result.session.created_at,
            expires_at: result.session.expires_at,
            admin_name: result.session.admin_name
          });
        } else {
          throw new Error(result.error || 'Invite not found');
        }
      } catch (err) {
        console.error('Error loading invite:', err);
        setError(err instanceof Error ? err.message : 'Invalid or expired invite');
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [token]);

  return { invite, loading, error };
};