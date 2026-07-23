'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { AppFrame } from '@/app/lib/components/ym/AppFrame';
import { YmButton } from '@/app/lib/components/ym/YmButton';
import { useAppStore } from '@/app/lib/app-store';
import { authClient, useSession } from '@/app/lib/auth/client';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { showError } = useAppStore();

  useEffect(() => {
    if (!isPending && !session?.user) router.replace('/');
  }, [isPending, session?.user, router]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [customLetterInstructions, setCustomLetterInstructions] = useState('');
  const [customMsgInstructions, setCustomMsgInstructions] = useState('');
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [promptsSaving, setPromptsSaving] = useState(false);
  const [promptsSuccess, setPromptsSuccess] = useState(false);

  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySaving, setApiKeySaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) {
          showError('Failed to load settings.');
          return;
        }
        const data = await res.json();
        setCustomLetterInstructions(data.customLetterInstructions ?? '');
        setCustomMsgInstructions(data.customMsgInstructions ?? '');
        setHasApiKey(Boolean(data.hasOpenrouterApiKey));
      } catch {
        showError('Failed to load settings.');
      } finally {
        setPromptsLoading(false);
      }
    }
    loadSettings();
  }, [showError]);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      const result = await authClient.changePassword({ currentPassword, newPassword });
      if (result.error) {
        setPasswordError(result.error.message || 'Failed to change password');
      } else {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handlePromptsSubmit(e: FormEvent) {
    e.preventDefault();
    setPromptsSaving(true);
    setPromptsSuccess(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customLetterInstructions, customMsgInstructions }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showError(json?.error ?? 'Failed to save prompt settings');
        return;
      }
      setPromptsSuccess(true);
    } catch {
      showError('Failed to save prompt settings. Please try again.');
    } finally {
      setPromptsSaving(false);
    }
  }

  async function handleSaveApiKey() {
    setApiKeySaving(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openrouterApiKey: apiKeyInput.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showError(json?.error ?? 'Failed to save API key');
        return;
      }
      setHasApiKey(true);
      setApiKeyInput('');
    } catch {
      showError('Failed to save API key. Please try again.');
    } finally {
      setApiKeySaving(false);
    }
  }

  async function handleClearApiKey() {
    setApiKeySaving(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearOpenrouterApiKey: true }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showError(json?.error ?? 'Failed to clear API key');
        return;
      }
      setHasApiKey(false);
      setApiKeyInput('');
    } catch {
      showError('Failed to clear API key. Please try again.');
    } finally {
      setApiKeySaving(false);
    }
  }

  return (
    <AppFrame>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              fontWeight: 'bold',
              fontSize: 14,
              color: 'oklch(0.4 0.2 295)',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            ★ Settings
          </div>

          <div className="ym-inset" style={{ padding: 16 }}>
            <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 10 }}>Change Password</div>
            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 12 }}>
                Current Password
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="ym-input"
                  style={{ marginTop: 4 }}
                  disabled={passwordSaving}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                New Password
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="ym-input"
                  style={{ marginTop: 4 }}
                  disabled={passwordSaving}
                />
              </label>

              {passwordError && (
                <div style={{ fontSize: 12, color: 'oklch(0.5 0.2 10)' }}>{passwordError}</div>
              )}
              {passwordSuccess && (
                <div style={{ fontSize: 12, color: 'oklch(0.5 0.15 145)' }}>Password changed.</div>
              )}

              <YmButton type="submit" variant="primary" disabled={passwordSaving} style={{ alignSelf: 'flex-start' }}>
                {passwordSaving ? 'Saving...' : 'Change Password'}
              </YmButton>
            </form>
          </div>

          <div className="ym-inset" style={{ padding: 16 }}>
            <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>Custom AI Instructions</div>
            <div style={{ fontSize: 11, color: 'oklch(0.5 0.02 295)', marginBottom: 10 }}>
              Add extra instructions on top of the core generation logic. Leave blank to use defaults.
            </div>

            {promptsLoading ? (
              <div style={{ fontSize: 12 }}>Loading...</div>
            ) : (
              <form onSubmit={handlePromptsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 12 }}>
                  Cover Letter Instructions
                  <textarea
                    className="ym-textarea"
                    rows={5}
                    value={customLetterInstructions}
                    onChange={(e) => setCustomLetterInstructions(e.target.value)}
                    style={{ marginTop: 4, width: '100%', resize: 'none' }}
                    disabled={promptsSaving}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Recruiter Message Instructions
                  <textarea
                    className="ym-textarea"
                    rows={5}
                    value={customMsgInstructions}
                    onChange={(e) => setCustomMsgInstructions(e.target.value)}
                    style={{ marginTop: 4, width: '100%', resize: 'none' }}
                    disabled={promptsSaving}
                  />
                </label>

                {promptsSuccess && (
                  <div style={{ fontSize: 12, color: 'oklch(0.5 0.15 145)' }}>Prompt settings saved.</div>
                )}

                <YmButton type="submit" variant="primary" disabled={promptsSaving} style={{ alignSelf: 'flex-start' }}>
                  {promptsSaving ? 'Saving...' : 'Save Prompts'}
                </YmButton>
              </form>
            )}
          </div>

          <div className="ym-inset" style={{ padding: 16 }}>
            <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>OpenRouter API Key</div>
            <div style={{ fontSize: 11, color: 'oklch(0.5 0.02 295)', marginBottom: 10 }}>
              Use your own OpenRouter key so generation runs on your credit. Stored encrypted. Leave the shared key in
              place by not entering anything.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {hasApiKey ? (
                <div style={{ fontSize: 12, color: 'oklch(0.5 0.15 145)' }}>A key is saved.</div>
              ) : (
                <div style={{ fontSize: 12, color: 'oklch(0.5 0.02 295)' }}>
                  No key saved. Using the shared server key.
                </div>
              )}

              <label style={{ fontSize: 12 }}>
                OpenRouter API Key
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="ym-input"
                  style={{ marginTop: 4, width: '100%' }}
                  placeholder="sk-or-..."
                  disabled={apiKeySaving}
                />
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <YmButton
                  type="button"
                  variant="primary"
                  disabled={apiKeySaving || apiKeyInput.trim().length === 0}
                  onClick={handleSaveApiKey}
                >
                  {apiKeySaving ? 'Saving...' : 'Save Key'}
                </YmButton>
                {hasApiKey && (
                  <YmButton type="button" disabled={apiKeySaving} onClick={handleClearApiKey}>
                    Clear Key
                  </YmButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
