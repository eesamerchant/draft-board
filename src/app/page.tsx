'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ROUTES } from '@/lib/constants';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          router.push(ROUTES.DASHBOARD);
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setIsChecking(false);
      }
    };

    checkSession();
  }, [router]);

  const switchMode = (newMode: 'login' | 'signup' | 'forgot') => {
    setMode(newMode);
    setError('');
    setSuccessMessage('');
    setPassword('');
    setConfirmPassword('');
  };

  const validateForm = (): boolean => {
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return false;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return false;
    }

    if (mode === 'forgot') {
      return true;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      );

      if (resetError) {
        setError(resetError.message || 'Failed to send reset email');
        return;
      }

      setSuccessMessage('Password reset link sent! Check your email.');
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (mode === 'forgot') {
      await handleForgotPassword();
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const supabase = createClient();

      if (mode === 'login') {
        // Login
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (authError) {
          setError(authError.message || 'Login failed');
          setLoading(false);
          return;
        }
      } else {
        // Signup
        const { error: authError, data } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (authError) {
          setError(authError.message || 'Signup failed');
          setLoading(false);
          return;
        }

        // Detect duplicate email: Supabase returns a user with empty identities
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          setError('An account already exists with this email. Try logging in instead.');
          setLoading(false);
          return;
        }

        // Check if email confirmation is required
        if (data?.user && !data?.session) {
          setError('');
          setSuccessMessage('Account created! Check your email to confirm, then log in.');
          setMode('login');
          setPassword('');
          setConfirmPassword('');
          setLoading(false);
          return;
        }
      }

      // Redirect to dashboard
      router.push(ROUTES.DASHBOARD);
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-white to-[var(--color-bg-secondary)] dark:from-[var(--color-bg)] dark:to-[var(--color-bg-secondary)]">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-[var(--color-primary)] rounded-full"></div>
        </div>
      </div>
    );
  }

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-white to-[var(--color-bg-secondary)] dark:from-[var(--color-bg)] dark:to-[var(--color-bg-secondary)] px-4 py-8">
      {/* Background grid pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-5 dark:opacity-10 bg-[linear-gradient(45deg,#8B5CF6_1px,transparent_1px)] bg-[length:40px_40px]"></div>
      </div>

      {/* Auth Card */}
      <div className="relative w-full max-w-md">
        <div className="card rounded-2xl shadow-lg">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] bg-clip-text text-transparent">
              Draft Board
            </h1>
            <p className="text-[var(--color-text-secondary)] mt-2">
              {isForgot ? 'Reset your password' : 'Make drafting easy for your league'}
            </p>
          </div>

          {/* Tabs (hidden in forgot mode) */}
          {!isForgot && (
            <div className="flex gap-2 mb-8 bg-[var(--color-bg-secondary)] dark:bg-[var(--color-bg)] p-1 rounded-lg">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                  isLogin
                    ? 'bg-[var(--color-primary)] text-white shadow-md'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                  isSignup
                    ? 'bg-[var(--color-primary)] text-white shadow-md'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div className="form-group">
              <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`input rounded-lg focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] ${
                  error && email ? 'border-red-500 focus:ring-red-500/50' : ''
                }`}
                disabled={loading}
              />
            </div>

            {/* Password Input (hidden in forgot mode) */}
            {!isForgot && (
              <div className="form-group">
                <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isLogin ? 'Enter your password' : 'Min 6 characters'}
                  className={`input rounded-lg focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] ${
                    error && password ? 'border-red-500 focus:ring-red-500/50' : ''
                  }`}
                  disabled={loading}
                />
              </div>
            )}

            {/* Confirm Password Input (Signup only) */}
            {isSignup && (
              <div className="form-group">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className={`input rounded-lg focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] ${
                    error && confirmPassword ? 'border-red-500 focus:ring-red-500/50' : ''
                  }`}
                  disabled={loading}
                />
              </div>
            )}

            {/* Forgot Password Link (Login only) */}
            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-sm text-[var(--color-primary)] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">{successMessage}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 mt-6 font-medium text-white rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] hover:shadow-lg hover:from-[var(--color-primary-dark)] hover:to-[var(--color-primary)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {isForgot ? 'Sending...' : isLogin ? 'Logging in...' : 'Creating account...'}
                </span>
              ) : (
                isForgot ? 'Send Reset Link' : isLogin ? 'Login' : 'Create Account'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-sm text-[var(--color-text-secondary)] mt-6">
            {isForgot ? (
              <>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-medium text-[var(--color-primary)] hover:underline"
                >
                  Back to login
                </button>
              </>
            ) : isLogin ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-medium text-[var(--color-primary)] hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-medium text-[var(--color-primary)] hover:underline"
                >
                  Login
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
