import React, { useState, useEffect, useCallback } from 'react';
import { User } from './types';
import { authService } from './services/authService';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async (preloadedUser?: User) => {
    if (preloadedUser) {
      setUser(preloadedUser);
      setLoading(false);
      return;
    }

    // Check if token passed in URL (e.g. from OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      localStorage.setItem('reachinbox_token', tokenParam);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const currentToken = localStorage.getItem('reachinbox_token');
    if (!currentToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const currentUser = await authService.getMe();
      setUser(currentUser);
    } catch {
      localStorage.removeItem('reachinbox_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#00A854] border-t-transparent"></div>
          <p className="mt-3 text-xs text-gray-500 font-medium">Loading ReachInbox...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={(u) => checkAuth(u)} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
};

export default App;
