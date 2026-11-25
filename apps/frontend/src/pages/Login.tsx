import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { API_BASE_URL } from '../services/api';
import { Eye, EyeOff } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user?: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('oliver.brown@domain.io');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth callback token or error in URL search parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    const token = params.get('token');

    if (err) {
      setError(decodeURIComponent(err));
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (token) {
      localStorage.setItem('reachinbox_token', token);
      window.history.replaceState({}, document.title, window.location.pathname);
      onLoginSuccess();
    }
  }, [onLoginSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await authService.login(email, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        (err.message?.includes('Network Error')
          ? `Cannot connect to backend API at ${API_BASE_URL}. Please ensure the backend is running.`
          : err.message || 'Login failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      {/* Centered Login Card (Figma node 59-6322) */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-gray-100 p-8 sm:p-10 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">Login</h1>

        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 leading-relaxed font-medium">
            {error}
          </div>
        )}

        {/* Google Login Button (Mint background per Figma) */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full bg-[#E8F5E9] hover:bg-[#d8eed9] text-gray-800 font-medium py-3 px-4 rounded-xl flex items-center justify-center space-x-3 transition-colors text-sm shadow-none cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.43 7.35 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.57 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>Login with Google</span>
        </button>

        {/* Divider: or sign up through email */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <span className="relative bg-white px-3 text-xs text-gray-400 font-normal">
            or sign up through email
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Email ID
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="oliver.brown@domain.io"
              className="w-full bg-[#F3F4F6] border-0 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#00A854] outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-[#F3F4F6] border-0 rounded-xl pl-4 pr-11 py-3 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#00A854] outline-none transition-all"
                required
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPassword(!showPassword);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-md cursor-pointer"
                tabIndex={-1}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button (Vibrant Green per Figma) */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00A854] hover:bg-[#009249] text-white font-medium py-3 px-4 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60 mt-2 cursor-pointer"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};
