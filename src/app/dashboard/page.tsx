'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { DraftBoard } from '@/lib/types';
import { ROUTES, STORAGE_KEYS } from '@/lib/constants';

// Inline SVG icons to avoid dependency issues
const IconPlus = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const IconSun = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
);
const IconMoon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
);
const IconLogOut = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);
const IconTrash = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
);
const IconEdit = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);

const MAX_DRAFTS = 3;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [drafts, setDrafts] = useState<DraftBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [createError, setCreateError] = useState('');

  // Load user and drafts
  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient();

        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push(ROUTES.HOME);
          return;
        }

        setUser(session.user);

        // Load theme
        const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark' | null;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        setTheme(initialTheme);
        applyTheme(initialTheme);

        // Fetch user's drafts
        const { data: draftsData, error } = await supabase
          .from('draft_boards')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading drafts:', error);
        } else {
          setDrafts(draftsData || []);
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const applyTheme = (newTheme: 'light' | 'dark') => {
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    applyTheme(newTheme);
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push(ROUTES.HOME);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleCreateDraft = async () => {
    if (drafts.length >= MAX_DRAFTS) {
      setCreateError(`Maximum ${MAX_DRAFTS} drafts allowed. Delete one to create a new draft.`);
      return;
    }

    setCreateLoading(true);
    setCreateError('');

    try {
      const supabase = createClient();

      // Verify we have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push(ROUTES.HOME);
        return;
      }

      const newDraft = {
        user_id: session.user.id,
        name: `Draft ${drafts.length + 1}`,
        status: 'setup' as const,
        timer_seconds: 60,
        num_teams: 8,
        max_players_per_team: 10,
        draft_type: 'snake' as const,
        draft_order_type: 'random' as const,
        trade_time_seconds: 30,
        is_multiplayer: false,
        sport_preset: null,
        position_list: [],
      };

      const { data: createdDraft, error } = await supabase
        .from('draft_boards')
        .insert(newDraft)
        .select()
        .single();

      if (error) {
        console.error('Error creating draft:', error);
        setCreateError(`Failed to create draft: ${error.message}`);
        return;
      }

      if (!createdDraft) {
        setCreateError('Failed to create draft. Please try again.');
        return;
      }

      setDrafts([createdDraft, ...drafts]);
      router.push(`/draft/new?id=${createdDraft.id}`);
    } catch (err: any) {
      console.error('Error creating draft:', err);
      setCreateError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('draft_boards')
        .delete()
        .eq('id', draftId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting draft:', error);
        return;
      }

      setDrafts(drafts.filter(d => d.id !== draftId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting draft:', err);
    }
  };

  const handleSaveDraftName = async (draftId: string) => {
    if (!editingName.trim()) {
      setEditingDraftId(null);
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('draft_boards')
        .update({ name: editingName })
        .eq('id', draftId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating draft:', error);
        return;
      }

      setDrafts(drafts.map(d =>
        d.id === draftId ? { ...d, name: editingName } : d
      ));
      setEditingDraftId(null);
      setEditingName('');
    } catch (err) {
      console.error('Error updating draft:', err);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'setup':
        return 'badge-warning';
      case 'active':
        return 'badge-success';
      case 'completed':
        return 'badge-danger';
      default:
        return 'badge-primary';
    }
  };

  const handleDraftClick = (draft: DraftBoard) => {
    if (draft.status === 'setup') {
      router.push(`/draft/new?id=${draft.id}`);
    } else {
      router.push(ROUTES.DRAFT(draft.id));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        {/* Nav skeleton */}
        <nav className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="w-32 h-8 bg-[var(--color-bg-secondary)] rounded animate-pulse"></div>
              <div className="w-24 h-8 bg-[var(--color-bg-secondary)] rounded animate-pulse"></div>
            </div>
          </div>
        </nav>

        {/* Content skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 bg-[var(--color-bg-secondary)] rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Navigation */}
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-sm)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] bg-clip-text text-transparent">
                Draft Board
              </h1>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Create Draft Button */}
              <button
                onClick={handleCreateDraft}
                disabled={createLoading || drafts.length >= MAX_DRAFTS}
                title={drafts.length >= MAX_DRAFTS ? `Maximum ${MAX_DRAFTS} drafts allowed` : ''}
                className="btn-primary rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconPlus size={18} />
                <span className="hidden sm:inline">Create Draft</span>
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="btn btn-secondary rounded-lg p-2"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <IconMoon size={18} />
                ) : (
                  <IconSun size={18} />
                )}
              </button>

              {/* User Menu */}
              <div className="relative group">
                <button className="btn btn-secondary rounded-lg px-3 flex items-center gap-2">
                  <span className="text-sm hidden sm:inline">{user?.email}</span>
                  <span className="text-xs sm:hidden">{user?.email?.split('@')[0]}</span>
                </button>

                {/* Dropdown */}
                <div className="absolute right-0 mt-0 w-48 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--color-bg-secondary)] flex items-center gap-2 rounded-lg font-medium text-red-600 dark:text-red-400"
                  >
                    <IconLogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Draft count */}
          <div className="pb-4 text-sm text-[var(--color-text-secondary)]">
            {drafts.length}/{MAX_DRAFTS} drafts
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        {/* Error Banner */}
        {createError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{createError}</p>
            <button
              onClick={() => setCreateError('')}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 ml-4 text-lg font-bold"
            >
              ×
            </button>
          </div>
        )}

        {drafts.length === 0 ? (
          // Empty State
          <div className="text-center py-16">
            <div className="mb-6">
              <div className="inline-block p-4 bg-[var(--color-primary)]/10 rounded-full">
                <IconPlus size={32} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-2">No drafts yet</h2>
            <p className="text-[var(--color-text-secondary)] mb-6 max-w-sm mx-auto">
              Create your first draft board to get started. You can manage up to {MAX_DRAFTS} drafts at a time.
            </p>
            <button
              onClick={handleCreateDraft}
              disabled={createLoading}
              className="btn-primary rounded-lg inline-flex items-center gap-2"
            >
              <IconPlus size={18} />
              Create Your First Draft
            </button>
          </div>
        ) : (
          // Draft Grid
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="card-interactive rounded-lg overflow-hidden group"
                onClick={() => handleDraftClick(draft)}
              >
                {/* Card Header */}
                <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
                  {editingDraftId === draft.id ? (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleSaveDraftName(draft.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveDraftName(draft.id);
                          if (e.key === 'Escape') setEditingDraftId(null);
                        }}
                        className="input rounded text-sm flex-1"
                        placeholder="Draft name"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveDraftName(draft.id);
                        }}
                        className="btn-primary btn-sm rounded"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-[var(--color-text)] line-clamp-2">
                          {draft.name}
                        </h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDraftId(draft.id);
                          setEditingName(draft.name);
                        }}
                        className="btn btn-ghost btn-sm rounded p-1"
                        title="Edit draft name"
                      >
                        <IconEdit size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="space-y-3 mb-4">
                  {/* Status Badge */}
                  <div>
                    <span className={`badge ${getStatusBadgeStyle(draft.status)}`}>
                      {draft.status.charAt(0).toUpperCase() + draft.status.slice(1)}
                    </span>
                  </div>

                  {/* Draft Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[var(--color-text-secondary)] text-xs">Teams</p>
                      <p className="font-medium text-[var(--color-text)]">{draft.num_teams}</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)] text-xs">Type</p>
                      <p className="font-medium text-[var(--color-text)] capitalize">{draft.draft_type}</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)] text-xs">Roster Size</p>
                      <p className="font-medium text-[var(--color-text)]">{draft.max_players_per_team}</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)] text-xs">Created</p>
                      <p className="font-medium text-[var(--color-text)]">{new Date(draft.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDraftClick(draft);
                    }}
                    className="text-sm text-[var(--color-primary)] font-medium hover:underline"
                  >
                    Open Board →
                  </button>
                  {deleteConfirm === draft.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-red-500">Delete?</span>
                      <button
                        onClick={() => handleDeleteDraft(draft.id)}
                        className="btn-danger btn-sm rounded text-xs px-2 py-1"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="btn-secondary btn-sm rounded text-xs px-2 py-1"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(draft.id);
                      }}
                      className="text-[var(--color-text-secondary)] hover:text-red-500 transition-colors p-1"
                      title="Delete draft"
                    >
                      <IconTrash size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* New Draft Card */}
            {drafts.length < MAX_DRAFTS && (
              <button
                onClick={handleCreateDraft}
                disabled={createLoading}
                className="card rounded-lg border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] flex flex-col items-center justify-center min-h-[280px] transition-all group"
              >
                <div className="p-3 rounded-full bg-[var(--color-bg-secondary)] group-hover:bg-[var(--color-primary)]/10 transition-colors mb-3">
                  <IconPlus size={24} />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {createLoading ? 'Creating...' : 'New Draft'}
                </span>
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
