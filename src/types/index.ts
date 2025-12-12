export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'tracked';
  createdAt: Date;
}

export interface TrackingSession {
  id: string;
  admin_id: string;
  tracked_user_id?: string;
  tracked_user_name: string;
  tracked_user_phone?: string;
  invite_token: string;
  invite_link?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'active' | 'inactive';
  accepted_at?: string;
  created_at: string;
  expires_at: string;
  lastLocation?: Location;
}

export interface Location {
  id?: string;
  session_id?: string;
  user_id?: string;
  latitude: number;
  longitude: number;
  created_at: string;
  accuracy: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  address?: string;
}

export interface AppState {
  currentUser: User | null;
  trackingSessions: TrackingSession[];
  locations: { [sessionId: string]: Location[] };
  isAuthenticated: boolean;
  currentPage: 'login' | 'dashboard' | 'consent' | 'register' | 'location-viewer' | 'tracking-active' | 'tracking-rejected';
  selectedSession: TrackingSession | null;
  inviteToken: string | null;
}