// Authentication manager
const AUTH_KEY = 'civic_incident_auth';

export const auth = {
  token: null,
  user: null,

  init() {
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

  save(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
  },

  clear() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(AUTH_KEY);
  },

  isAuthenticated() {
    return !!this.token;
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
