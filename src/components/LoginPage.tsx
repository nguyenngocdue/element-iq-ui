/**
 * Login/Signup page — shown when user is not authenticated.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { BrandHeader } from './LoadingScreen';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    if (user) {
      navigate(returnTo, { replace: true });
    }
  }, [user, navigate, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, username);

    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-10">
          <BrandHeader />
        </div>

        {/* Card */}
        <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-[#a0a5b5] mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#252526] border border-[#3c3c3c] rounded-md px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                  placeholder="your_username"
                  required
                  minLength={3}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#a0a5b5] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#252526] border border-[#3c3c3c] rounded-md px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#a0a5b5] mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#252526] border border-[#3c3c3c] rounded-md px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-semibold py-2.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#858585] space-y-3">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button onClick={() => setMode('signup')} className="text-[#10b981] hover:underline font-medium">
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button onClick={() => setMode('login')} className="text-[#10b981] hover:underline font-medium">
                  Sign in
                </button>
              </p>
            )}
            <p>
              <Link to="/" className="text-[#b0b0b0] hover:text-white transition-colors">
                Continue to dashboard without signing in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
