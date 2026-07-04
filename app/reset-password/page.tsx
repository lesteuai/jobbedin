'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/app/lib/auth/client';
import { YmButton } from '@/app/lib/components/ym/YmButton';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) {
        setError(result.error.message || 'Failed to reset password');
      } else {
        setSuccess(true);
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
            ★ Reset Password
          </div>

          {!token && (
            <div style={{ fontSize: 12, color: 'oklch(0.5 0.2 10)', textAlign: 'center' }}>
              Missing or invalid reset link. Request a new one from the sign in page.
            </div>
          )}

          {token && success && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'oklch(0.5 0.15 145)' }}>
                Your password has been reset.
              </div>
              <YmButton variant="primary" onClick={() => (window.location.href = '/')}>
                Back to Sign In
              </YmButton>
            </div>
          )}

          {token && !success && (
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <label style={{ fontSize: 12 }}>
                New Password
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="ym-input"
                  style={{ marginTop: 4 }}
                  disabled={loading}
                />
              </label>

              {error && (
                <div style={{ fontSize: 12, color: 'oklch(0.5 0.2 10)', marginTop: 4 }}>
                  {error}
                </div>
              )}

              <YmButton
                type="submit"
                variant="primary"
                style={{ marginTop: 6 }}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Reset Password'}
              </YmButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
