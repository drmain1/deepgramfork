// Session manager to prevent duplicate session creation
class SessionManager {
  constructor() {
    this.sessionPromise = null;
    this.lastSessionTime = null;
    this.SESSION_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  async ensureSession(getToken) {
    const now = Date.now();
    
    // If we have a recent session, don't create a new one
    if (this.lastSessionTime && (now - this.lastSessionTime) < this.SESSION_DURATION) {
      return true;
    }

    // If a session creation is already in progress, wait for it
    if (this.sessionPromise) {
      return this.sessionPromise;
    }

    // Create a new session
    this.sessionPromise = this.createSession(getToken);
    
    try {
      const result = await this.sessionPromise;
      this.lastSessionTime = now;
      return result;
    } finally {
      this.sessionPromise = null;
    }
  }

  async createSession(getToken) {
    try {
      const token = await getToken();
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Failed to create backend session:', response.status);
        return false;
      }
      
      console.log('Backend session created/verified');
      return true;
    } catch (error) {
      console.error('Error creating backend session:', error);
      return false;
    }
  }

  clearSession() {
    this.lastSessionTime = null;
    this.sessionPromise = null;
  }
}

// Create a singleton instance
export const sessionManager = new SessionManager();