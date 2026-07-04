'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, type FormEvent } from 'react';
import { authClient, useSession } from '@/app/lib/auth/client';
import { YmButton } from '@/app/lib/components/ym/YmButton';
import { useAppStore } from '@/app/lib/app-store';

type Mode = 'signin' | 'signup' | 'forgot' | 'delete';

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { clearStore, refreshResumes } = useAppStore();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) router.replace('/resumes');
  }, [session?.user, router]);

  if (isPending || session?.user) return null;

  const titles: Record<Mode, string> = {
    signin: 'Sign In',
    signup: 'Sign Up',
    forgot: 'Forgot Password',
    delete: 'Delete Account',
  };

  const submitLabel: Record<Mode, string> = {
    signin: 'Sign In',
    signup: 'Sign Up',
    forgot: 'Send Reset Link',
    delete: 'Delete Account',
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === 'signin') {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message || 'Sign in failed');
        } else {
          clearStore();
          await refreshResumes();
          router.push('/resumes');
        }
      } else if (mode === 'signup') {
        const result = await authClient.signUp.email({ email, password, name: email });
        if (result.error) {
          setError(result.error.message || 'Sign up failed');
        } else {
          clearStore();
          await refreshResumes();
          router.push('/resumes');
        }
      } else if (mode === 'forgot') {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (result.error) {
          setError(result.error.message || 'Failed to send reset link');
        } else {
          setInfo('Check your email for a link to reset your password.');
        }
      } else if (mode === 'delete') {
        if (!window.confirm('Permanently delete this account and all its data? This cannot be undone.')) {
          setLoading(false);
          return;
        }
        const signInResult = await authClient.signIn.email({ email, password });
        if (signInResult.error) {
          setError('Invalid email or password');
        } else {
          const result = await authClient.deleteUser({ password });
          if (result.error) {
            setError(result.error.message || 'Failed to delete account');
          } else {
            clearStore();
            setInfo(
              'If confirmation is required, check your email to finish deleting your account. Otherwise your account has been deleted.'
            );
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div className="ym-window" style={{ width: 360, display: 'flex', flexDirection: 'column' }}>
        <div className="ym-titlebar">
          <span style={{ fontSize: 14, flex: 1 }}>☺ JobbedIn</span>
          <button className="ym-winbtn">_</button>
          <button className="ym-winbtn">▭</button>
          <button className="ym-winbtn">×</button>
        </div>

        <div style={{ padding: 20 }}>
          <div
            style={{
              fontWeight: 'bold',
              fontSize: 14,
              color: 'oklch(0.4 0.2 295)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            ★ {titles[mode]}
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <label style={{ fontSize: 12 }}>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="ym-input"
                style={{ marginTop: 4 }}
                disabled={loading}
              />
            </label>
            
            {mode !== 'forgot' && (
              <label style={{ fontSize: 12 }}>
                Password
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ym-input"
                  style={{ marginTop: 4 }}
                  disabled={loading}
                />
              </label>
            )}

            {error && (
              <div style={{ fontSize: 12, color: 'oklch(0.5 0.2 10)', marginTop: 4 }}>
                {error}
              </div>
            )}

            {info && (
              <div style={{ fontSize: 12, color: 'oklch(0.5 0.15 145)', marginTop: 4 }}>
                {info}
              </div>
            )}

            <YmButton
              type="submit"
              variant="primary"
              style={{ marginTop: 6 }}
              disabled={loading}
            >
              {loading ? 'Loading...' : submitLabel[mode]}
            </YmButton>
          </form>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              marginTop: 14,
              fontSize: 12,
            }}
          >
            {mode === 'signin' && (
              <>
                <button type="button" onClick={() => setMode('signup')} style={linkBtn}>
                  Sign Up
                </button>
                <button type="button" onClick={() => setMode('forgot')} style={linkBtn}>
                  Forgot Password
                </button>
              </>
            )}
            {mode === 'signup' && (
              <>
                <button type="button" onClick={() => setMode('signin')} style={linkBtn}>
                  Back to Sign In
                </button>
                <button type="button" onClick={() => setMode('delete')} style={linkBtn}>
                  Delete Account
                </button>
              </>
            )}
            {mode === 'forgot' && (
              <button type="button" onClick={() => setMode('signin')} style={linkBtn}>
                Back to Sign In
              </button>
            )}
            {mode === 'delete' && (
              <button type="button" onClick={() => setMode('signin')} style={linkBtn}>
                Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'oklch(0.4 0.2 260)',
  textDecoration: 'underline',
  cursor: 'pointer',
  fontSize: 12,
};
