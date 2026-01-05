// Firebase Authentication manager
const AUTH_KEY = 'civic_incident_auth';

export const auth = {
  token: null,
  user: null,
  firebaseUser: null,

  init() {
    // Check if we have stored auth data
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.token = data.token;
        this.user = data.user;
      } catch {
        this.clear();
      }
    }
  },

  async refreshToken() {
    if (!this.firebaseUser) return null;
    
    try {
      const token = await this.firebaseUser.getIdToken(true);
      this.token = token;
      
      // Update localStorage
      if (this.user) {
        localStorage.setItem(AUTH_KEY, JSON.stringify({ token: this.token, user: this.user }));
      }
      
      return token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  },

  async save(firebaseUser, userData) {
    this.firebaseUser = firebaseUser;
    this.user = userData;
    
    // Get Firebase ID token
    try {
      this.token = await firebaseUser.getIdToken();
      localStorage.setItem(AUTH_KEY, JSON.stringify({ token: this.token, user: this.user }));
    } catch (error) {
      console.error('Failed to get ID token:', error);
      throw error;
    }
  },

  clear() {
    this.token = null;
    this.user = null;
    this.firebaseUser = null;
    localStorage.removeItem(AUTH_KEY);
  },

  isAuthenticated() {
    return !!this.token && !!this.user;
  },

  isAdmin() {
    return this.user?.role === 'admin';
  },

  getHeaders() {
    if (this.token) {
      return {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      };
    }
    return {
      'Content-Type': 'application/json'
    };
  }
};
