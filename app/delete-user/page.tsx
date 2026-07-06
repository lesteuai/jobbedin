'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { YmButton } from '@/app/lib/components/ym/YmButton';

function DeleteUserStatus() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

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
            ★ Delete Account
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: error ? 'oklch(0.5 0.2 10)' : 'oklch(0.5 0.15 145)', textAlign: 'center' }}>
              {error ? 'The deletion link is invalid or has expired. Request account deletion again from the sign in page.' : 'Your account and all its data have been permanently deleted.'}
            </div>
            <YmButton variant="primary" onClick={() => (window.location.href = '/')}>
              Back to Sign In
            </YmButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeleteUserPage() {
  return (
    <Suspense fallback={null}>
      <DeleteUserStatus />
    </Suspense>
  );
}
