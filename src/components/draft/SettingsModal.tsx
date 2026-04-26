'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { DraftBoard } from '@/lib/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerListPosition: 'side' | 'bottom';
  onPlayerListPositionChange: (pos: 'side' | 'bottom') => void;
  draft?: DraftBoard | null;
  onDraftUpdate?: (draft: DraftBoard) => void;
  onResetBoard?: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  playerListPosition,
  onPlayerListPositionChange,
  draft,
  onDraftUpdate,
  onResetBoard,
}: SettingsModalProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Draft settings editing
  const [editName, setEditName] = useState('');
  const [editTimer, setEditTimer] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetText, setResetText] = useState('');

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme = prefersDark ? 'dark' : 'light';
      setTheme(initialTheme);
      applyTheme(initialTheme);
    }
  }, []);

  // Sync draft data into edit fields
  useEffect(() => {
    if (draft) {
      setEditName(draft.name);
      setEditTimer(draft.timer_seconds);
    }
  }, [draft]);

  const applyTheme = (newTheme: 'light' | 'dark') => {
    const htmlElement = document.documentElement;
    if (newTheme === 'dark') {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
    localStorage.setItem('theme', newTheme);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const handleSaveDraftSettings = async () => {
    if (!draft || !onDraftUpdate) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const updates: Partial<DraftBoard> = {
        name: editName.trim() || draft.name,
        timer_seconds: editTimer,
      };
      const { error } = await supabase.from('draft_boards').update(updates).eq('id', draft.id);
      if (!error) {
        onDraftUpdate({ ...draft, ...updates } as DraftBoard);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Error saving draft settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetBoard = () => {
    if (resetText !== 'RESET') return;
    setShowResetConfirm(false);
    setResetText('');
    if (onResetBoard) onResetBoard();
  };

  if (!mounted || !isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <h2 className="text-xl font-bold text-[var(--color-text)]">Settings</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors text-[var(--color-text-secondary)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Draft Board Settings */}
          {draft && onDraftUpdate && (
            <div className="pb-6 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-text)] mb-4">Draft Board Settings</h3>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Board Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>

                {/* Timer */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Timer (seconds per pick, 0 = off)</label>
                  <input
                    type="number"
                    value={editTimer}
                    onChange={(e) => setEditTimer(Math.max(0, parseInt(e.target.value) || 0))}
                    min={0}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>

                {/* Info display */}
                <div className="bg-[var(--color-bg-secondary)] rounded-lg p-3 space-y-1">
                  <p className="text-xs text-[var(--color-text-secondary)]">Teams: <span className="font-semibold text-[var(--color-text)]">{draft.num_teams}</span></p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Rounds: <span className="font-semibold text-[var(--color-text)]">{draft.max_players_per_team}</span></p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Sport: <span className="font-semibold text-[var(--color-text)]">{draft.sport_preset || 'Custom'}</span></p>
                </div>

                <button
                  onClick={handleSaveDraftSettings}
                  disabled={saving}
                  className="w-full px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: saved ? '#16A34A' : 'var(--color-primary)' }}
                >
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Player List Position */}
          <div className="pb-6 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Player List Position</h3>
            <div className="space-y-2">
              <button
                onClick={() => onPlayerListPositionChange('side')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                  playerListPosition === 'side'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-secondary)]'
                }`}
              >
                <svg className={`w-5 h-5 flex-shrink-0 ${playerListPosition === 'side' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4v16" />
                </svg>
                <span className={`text-sm font-medium ${playerListPosition === 'side' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                  Side Panel
                </span>
              </button>
              <button
                onClick={() => onPlayerListPositionChange('bottom')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                  playerListPosition === 'bottom'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-secondary)]'
                }`}
              >
                <svg className={`w-5 h-5 flex-shrink-0 ${playerListPosition === 'bottom' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16h16" />
                </svg>
                <span className={`text-sm font-medium ${playerListPosition === 'bottom' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                  Bottom Panel
                </span>
              </button>
            </div>
          </div>

          {/* Theme */}
          <div className="pb-6 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Theme</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleThemeChange('light')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                  theme === 'light'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-secondary)]'
                }`}
              >
                <svg className={`w-5 h-5 ${theme === 'light' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1m-16 0H1m15.364 1.636l-.707.707M6.343 6.343l-.707-.707m12.728 0l-.707.707m-12.02 12.02l-.707-.707M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className={`text-sm font-medium ${theme === 'light' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}>Light Mode</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-secondary)]'
                }`}
              >
                <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}>Dark Mode</span>
              </button>
            </div>
          </div>

          {/* Reset Board */}
          {onResetBoard && (
            <div>
              <h3 className="text-sm font-semibold text-red-500 mb-3">Danger Zone</h3>
              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-red-300 text-red-600 font-medium hover:bg-red-50 transition-colors text-sm"
                >
                  Reset Draft Board
                </button>
              ) : (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-red-700">This action cannot be reversed!</p>
                      <p className="text-xs text-red-600 mt-1">All picks will be cleared and the draft will reset to the beginning. Trade history will also be lost.</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-red-600 mb-1">Type RESET to confirm</label>
                    <input
                      type="text"
                      value={resetText}
                      onChange={(e) => setResetText(e.target.value)}
                      placeholder="RESET"
                      className="w-full px-3 py-2 text-sm border-2 border-red-300 rounded-lg bg-white text-red-700 placeholder-red-300 focus:ring-2 focus:ring-red-400 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowResetConfirm(false); setResetText(''); }}
                      className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm hover:bg-[var(--color-bg-secondary)]"
                    >Cancel</button>
                    <button
                      onClick={handleResetBoard}
                      disabled={resetText !== 'RESET'}
                      className="flex-1 px-3 py-2 rounded-lg bg-red-600 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
                    >Confirm Reset</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
