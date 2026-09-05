import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Zap, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Alert } from '../../components/common/Alert';

export function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Please enter both your username and password.');
      return;
    }

    setIsLoading(true);

    try {
      await login(cleanUsername, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 font-sans flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 selection:bg-amber-100 selection:text-amber-900">
      {/* Top Bar: Return to Public Site */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Public Watch</span>
        </button>

        <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded bg-stone-200/70 text-stone-600">
          Metro Cebu
        </span>
      </div>

      {/* Main Authentication Container */}
      <div className="my-auto sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8 space-y-2">
          {/* Brand Monogram */}
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/15 text-amber-800 border border-amber-500/30 mb-2">
            <Zap className="w-5 h-5 fill-current stroke-[2.5]" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 block">
              POWERWATCH PORTAL
            </span>
            <h1 className="text-2xl sm:text-3xl font-light font-serif text-stone-950 tracking-tight">
              Administrative Access
            </h1>
          </div>

          <p className="text-xs text-stone-500 font-light max-w-xs mx-auto">
            Authorized management for Visayan Electric rotational advisories, schedules, and geographic parser.
          </p>
        </div>

        {/* Secure Form Box */}
        <div className="bg-white py-8 px-6 sm:px-9 rounded-2xl border border-stone-200/90 shadow-xs">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {error && (
              <Alert type="error" title="Authentication Error">
                {error}
              </Alert>
            )}

            <div className="space-y-4">
              <Input
                label="Username"
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter admin username"
                autoComplete="username"
                disabled={isLoading}
              />

              <Input
                label="Password"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2 bg-stone-950 hover:bg-stone-800 text-white font-mono text-xs tracking-wider uppercase py-3 rounded-lg cursor-pointer transition-colors"
              isLoading={isLoading}
              icon={<Lock className="w-3.5 h-3.5" />}
            >
              Sign In to Console
            </Button>
          </form>
        </div>
      </div>

      {/* Editorial Civic Footer */}
      <footer className="sm:mx-auto sm:w-full sm:max-w-md text-center pt-8 text-[11px] font-mono text-stone-400 space-y-1">
        <div>PowerWatch &bull; Metro Cebu Civic Power Platform</div>
        <div>&copy; {new Date().getFullYear()} All rights reserved.</div>
      </footer>
    </div>
  );
}