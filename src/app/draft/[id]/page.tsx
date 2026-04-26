'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import type {
  DraftBoard,
  DraftTeam,
  DraftPlayer,
  DraftPick,
  DraftPlan,
  DraftMode,
} from '@/lib/types';
import DraftGrid from '@/components/draft/DraftGrid';
import PlayerPanel from '@/components/draft/PlayerPanel';
import DraftTimer from '@/components/draft/DraftTimer';
import TradePanel, { TradeLogEntry } from '@/components/draft/TradePanel';
import SettingsModal from '@/components/draft/SettingsModal';

interface UndoAction {
  type: 'pick' | 'edit_move' | 'edit_remove' | 'trade';
  data: Record<string, unknown>;
}

export default function DraftPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.id as string;
  const supabase = createClient();

  const [draft, setDraft] = useState<DraftBoard | null>(null);
  const [teams, setTeams] = useState<DraftTeam[]>([]);
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [plans, setPlans] = useState<DraftPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<DraftMode>('draft');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [playerListPosition, setPlayerListPosition] = useState<'side' | 'bottom'>('side');
  const [showNotes, setShowNotes] = useState(true);
  const [tradeLog, setTradeLog] = useState<TradeLogEntry[]>([]);

  // Plan mode overlay state
  const [planSelectedPickId, setPlanSelectedPickId] = useState<string | null>(null);
  const [planSelectedPlayerId, setPlanSelectedPlayerId] = useState<string | null>(null);

  // Email/save state
  const [showPlayerListModal, setShowPlayerListModal] = useState(false);
  const [showTradeLogModal, setShowTradeLogModal] = useState(false);
  const [playerListSearch, setPlayerListSearch] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'choose' | 'email'>('choose');
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const currentPickIndex = useMemo(() => picks.findIndex((p) => !p.player_id), [picks]);

  // Load draft data
  useEffect(() => {
    const loadDraft = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: draftData, error: draftError } = await supabase
          .from('draft_boards').select('*').eq('id', draftId).single();
        if (draftError) throw draftError;
        setDraft(draftData);
        setTimerSeconds(draftData.timer_seconds);

        const { data: teamsData, error: teamsError } = await supabase
          .from('draft_board_teams').select('*').eq('draft_id', draftId).order('draft_order', { ascending: true });
        if (teamsError) throw teamsError;
        setTeams(teamsData || []);

        const { data: playersData, error: playersError } = await supabase
          .from('draft_board_players').select('*').eq('draft_id', draftId);
        if (playersError) throw playersError;
        setPlayers(playersData || []);

        const { data: picksData, error: picksError } = await supabase
          .from('draft_board_picks').select('*').eq('draft_id', draftId).order('pick_number', { ascending: true });
        if (picksError) throw picksError;
        setPicks(picksData || []);

        const { data: plansData, error: plansError } = await supabase
          .from('draft_board_plans').select('*').eq('draft_id', draftId);
        if (plansError) throw plansError;
        setPlans(plansData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load draft');
      } finally {
        setLoading(false);
      }
    };
    if (draftId) loadDraft();
  }, [draftId]);

  // Realtime
  useEffect(() => {
    if (!draftId) return;
    const picksChannel = supabase.channel(`picks:${draftId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_board_picks', filter: `draft_id=eq.${draftId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') setPicks((prev) => [...prev, payload.new as DraftPick].sort((a, b) => a.pick_number - b.pick_number));
          else if (payload.eventType === 'UPDATE') setPicks((prev) => prev.map((p) => p.id === (payload.new as DraftPick).id ? (payload.new as DraftPick) : p));
          else if (payload.eventType === 'DELETE') setPicks((prev) => prev.filter((p) => p.id !== (payload.old as any).id));
        }).subscribe();
    const playersChannel = supabase.channel(`players:${draftId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'draft_board_players', filter: `draft_id=eq.${draftId}` },
        (payload) => { setPlayers((prev) => prev.map((p) => p.id === (payload.new as DraftPlayer).id ? (payload.new as DraftPlayer) : p)); }).subscribe();
    return () => { supabase.removeChannel(picksChannel); supabase.removeChannel(playersChannel); };
  }, [draftId]);

  // Timer — counts down to 0 then continues into negative (overtime)
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setTimerSeconds((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // Pick player
  const handlePlayerPicked = useCallback(async (playerId: string) => {
    if (currentPickIndex === -1 || !picks[currentPickIndex]) return;
    const currentPk = picks[currentPickIndex];
    const pickedPlayer = players.find((p) => p.id === playerId);
    if (!pickedPlayer) return;
    try {
      await supabase.from('draft_board_picks').update({ player_id: playerId, picked_at: new Date().toISOString() }).eq('id', currentPk.id);
      await supabase.from('draft_board_players').update({ is_drafted: true }).eq('id', playerId);
      await supabase.from('draft_board_plans').delete().eq('draft_id', draftId).eq('player_name', pickedPlayer.name);
      setUndoStack((prev) => [...prev, { type: 'pick', data: { pick_id: currentPk.id, player_id: playerId } }]);
      setTimerSeconds(draft?.timer_seconds ?? 0);
      setTimerRunning(false);
    } catch (err) { console.error('Error picking player:', err); }
  }, [currentPickIndex, picks, players, draftId, draft, supabase]);

  // Undo
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    try {
      if (last.type === 'pick') {
        const { pick_id, player_id } = last.data as { pick_id: string; player_id: string };
        await supabase.from('draft_board_picks').update({ player_id: null, picked_at: null }).eq('id', pick_id);
        await supabase.from('draft_board_players').update({ is_drafted: false }).eq('id', player_id);
      }
      setUndoStack((prev) => prev.slice(0, -1));
    } catch (err) { console.error('Undo error:', err); }
  }, [undoStack, supabase]);

  // Edit move (pick-to-pick)
  const handleEditMove = useCallback(async (fromPickId: string, toPickId: string) => {
    const fromPick = picks.find((p) => p.id === fromPickId);
    const toPick = picks.find((p) => p.id === toPickId);
    if (!fromPick || !toPick || !fromPick.player_id) return;
    try {
      if (toPick.player_id) {
        await supabase.from('draft_board_picks').update({ player_id: toPick.player_id }).eq('id', fromPickId);
        await supabase.from('draft_board_picks').update({ player_id: fromPick.player_id }).eq('id', toPickId);
      } else {
        await supabase.from('draft_board_picks').update({ player_id: null }).eq('id', fromPickId);
        await supabase.from('draft_board_picks').update({ player_id: fromPick.player_id }).eq('id', toPickId);
      }
      setUndoStack((prev) => [...prev, { type: 'edit_move', data: { fromPickId, toPickId } }]);
    } catch (err) { console.error('Edit move error:', err); }
  }, [picks, supabase]);

  // Edit: drop a player from the player panel onto a grid cell
  const handlePlayerDropped = useCallback(async (playerId: string, pickId: string) => {
    const player = players.find((p) => p.id === playerId);
    const pick = picks.find((p) => p.id === pickId);
    if (!player || !pick || player.is_drafted) return;
    try {
      // If the cell already has a player, un-draft them first
      if (pick.player_id) {
        await supabase.from('draft_board_players').update({ is_drafted: false }).eq('id', pick.player_id);
      }
      await supabase.from('draft_board_picks').update({ player_id: playerId, picked_at: new Date().toISOString() }).eq('id', pickId);
      await supabase.from('draft_board_players').update({ is_drafted: true }).eq('id', playerId);
      setUndoStack((prev) => [...prev, { type: 'edit_move', data: { fromPickId: null, toPickId: pickId, playerId } }]);
    } catch (err) { console.error('Player drop error:', err); }
  }, [players, picks, supabase]);

  // Edit remove
  const handleEditRemove = useCallback(async (pickId: string) => {
    const pick = picks.find((p) => p.id === pickId);
    if (!pick?.player_id) return;
    try {
      await supabase.from('draft_board_picks').update({ player_id: null }).eq('id', pickId);
      await supabase.from('draft_board_players').update({ is_drafted: false }).eq('id', pick.player_id);
      setUndoStack((prev) => [...prev, { type: 'edit_remove', data: { pick_id: pickId, player_id: pick.player_id } }]);
    } catch (err) { console.error('Edit remove error:', err); }
  }, [picks, supabase]);

  // Trade confirm — swaps team_id on selected picks so they move between team columns
  const handleConfirmTrade = useCallback(async (trade: { picksFromA: string[]; picksFromB: string[]; teamAId: string; teamBId: string }) => {
    try {
      const teamAName = teams.find((t) => t.id === trade.teamAId)?.name || '?';
      const teamBName = teams.find((t) => t.id === trade.teamBId)?.name || '?';
      const logMoves: TradeLogEntry['moves'] = [];
      const playerMap = new Map(players.map((p) => [p.id, p]));

      // Move picks from Team A to Team B
      for (const pickId of trade.picksFromA) {
        const pick = picks.find((p) => p.id === pickId);
        if (!pick) continue;
        await supabase.from('draft_board_picks').update({ team_id: trade.teamBId }).eq('id', pickId);
        const player = pick.player_id ? playerMap.get(pick.player_id) : null;
        logMoves.push({
          pickLabel: player ? `${player.name} (R${pick.round}.${pick.pick_in_round})` : `Pick #${pick.pick_number}`,
          fromTeam: teamAName,
          toTeam: teamBName,
        });
      }

      // Move picks from Team B to Team A
      for (const pickId of trade.picksFromB) {
        const pick = picks.find((p) => p.id === pickId);
        if (!pick) continue;
        await supabase.from('draft_board_picks').update({ team_id: trade.teamAId }).eq('id', pickId);
        const player = pick.player_id ? playerMap.get(pick.player_id) : null;
        logMoves.push({
          pickLabel: player ? `${player.name} (R${pick.round}.${pick.pick_in_round})` : `Pick #${pick.pick_number}`,
          fromTeam: teamBName,
          toTeam: teamAName,
        });
      }

      // Update local state
      setPicks((prev) => prev.map((p) => {
        if (trade.picksFromA.includes(p.id)) return { ...p, team_id: trade.teamBId };
        if (trade.picksFromB.includes(p.id)) return { ...p, team_id: trade.teamAId };
        return p;
      }).sort((a, b) => a.pick_number - b.pick_number));

      setTradeLog((prev) => [{
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        teams: [teamAName, teamBName],
        moves: logMoves,
      }, ...prev]);
      setMode('draft');
    } catch (err) { console.error('Trade error:', err); }
  }, [picks, players, teams, supabase]);

  // Plan handlers
  const handlePlanAdd = useCallback(async (pickId: string, playerName: string) => {
    try {
      const { data } = await supabase.from('draft_board_plans').insert({ draft_id: draftId, pick_id: pickId, player_name: playerName }).select().single();
      if (data) setPlans((prev) => [...prev, data]);
      setPlanSelectedPickId(null);
      setPlanSelectedPlayerId(null);
    } catch (err) { console.error('Plan add error:', err); }
  }, [draftId, supabase]);

  const handlePlanRemove = useCallback(async (planId: string) => {
    try {
      await supabase.from('draft_board_plans').delete().eq('id', planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err) { console.error('Plan remove error:', err); }
  }, [supabase]);

  // Plan mode: pick clicked from grid
  const handlePlanPickClick = useCallback((pickId: string) => {
    if (planSelectedPlayerId) {
      const player = players.find((p) => p.id === planSelectedPlayerId);
      if (player) handlePlanAdd(pickId, player.name);
    } else {
      setPlanSelectedPickId(pickId);
      setPlanSelectedPlayerId(null);
    }
  }, [planSelectedPlayerId, players, handlePlanAdd]);

  // Plan mode: player clicked from panel
  const handlePlanPlayerClick = useCallback((playerId: string) => {
    if (planSelectedPickId) {
      const player = players.find((p) => p.id === playerId);
      if (player) handlePlanAdd(planSelectedPickId, player.name);
    } else {
      setPlanSelectedPlayerId(playerId);
      setPlanSelectedPickId(null);
    }
  }, [planSelectedPickId, players, handlePlanAdd]);

  const cancelPlanSelection = () => {
    setPlanSelectedPickId(null);
    setPlanSelectedPlayerId(null);
  };

  // Reset board
  const handleResetBoard = useCallback(async () => {
    if (!draftId || !draft) return;
    try {
      // Recalculate original team assignments based on draft order and type
      const sortedTeams = [...teams].sort((a, b) => a.draft_order - b.draft_order);
      const numTeams = sortedTeams.length;
      const totalRounds = draft.max_players_per_team;
      const originalTeamMap = new Map<number, string>(); // pick_number -> original team_id
      let pickNumber = 1;

      for (let round = 0; round < totalRounds; round++) {
        let teamOrder = Array.from({ length: numTeams }, (_, i) => i);
        if (draft.draft_type === 'snake' && round % 2 === 1) {
          teamOrder.reverse();
        }
        for (const teamIndex of teamOrder) {
          originalTeamMap.set(pickNumber, sortedTeams[teamIndex].id);
          pickNumber++;
        }
      }

      // Clear all picks' player assignments and restore original team_id
      const sortedPicks = [...picks].sort((a, b) => a.pick_number - b.pick_number);
      for (const pick of sortedPicks) {
        const originalTeamId = originalTeamMap.get(pick.pick_number);
        if (originalTeamId) {
          await supabase.from('draft_board_picks').update({
            player_id: null,
            picked_at: null,
            team_id: originalTeamId,
          }).eq('id', pick.id);
        }
      }

      // Mark all players as undrafted
      await supabase.from('draft_board_players').update({ is_drafted: false }).eq('draft_id', draftId);
      // Clear all plans
      await supabase.from('draft_board_plans').delete().eq('draft_id', draftId);
      // Reset local state
      setPicks((prev) => prev.map((p) => ({
        ...p,
        player_id: null,
        picked_at: null,
        team_id: originalTeamMap.get(p.pick_number) || p.team_id,
      })).sort((a, b) => a.pick_number - b.pick_number));
      setPlayers((prev) => prev.map((p) => ({ ...p, is_drafted: false })));
      setPlans([]);
      setTradeLog([]);
      setUndoStack([]);
      setTimerSeconds(draft?.timer_seconds || 0);
      setTimerRunning(false);
      setShowSettings(false);
    } catch (err) { console.error('Reset board error:', err); }
  }, [draftId, draft, teams, picks, supabase]);

  // Save / email draft
  const handleSendEmail = useCallback(async () => {
    if (!emailAddress.trim() || !draft) return;
    setEmailSending(true);
    try {
      // Build the draft summary text
      const lines: string[] = [];
      lines.push(`Draft Board: ${draft.name}`);
      lines.push(`Date: ${new Date().toLocaleDateString()}`);
      lines.push(`Type: ${draft.draft_type} | Teams: ${draft.num_teams} | Rounds: ${draft.max_players_per_team}`);
      lines.push('');
      lines.push('=== DRAFT RESULTS ===');
      lines.push('');

      const teamMap = new Map(teams.map((t) => [t.id, t]));
      const playerMap = new Map(players.map((p) => [p.id, p]));

      picks.forEach((pick) => {
        const team = teamMap.get(pick.team_id);
        const player = pick.player_id ? playerMap.get(pick.player_id) : null;
        const playerInfo = player ? `${player.name}${player.primary_position ? ` (${player.primary_position})` : ''}` : '(Empty)';
        lines.push(`R${pick.round} Pick ${pick.pick_in_round} (#${pick.pick_number}) - ${team?.name || 'Unknown'}: ${playerInfo}`);
      });

      if (tradeLog.length > 0) {
        lines.push('');
        lines.push('=== TRADE LOG ===');
        tradeLog.forEach((entry, idx) => {
          lines.push(`\nTrade #${idx + 1} (${new Date(entry.timestamp).toLocaleString()}):`);
          entry.moves.forEach((m) => {
            lines.push(`  ${m.pickLabel}: ${m.fromTeam} -> ${m.toTeam}`);
          });
        });
      }

      // Team summaries
      lines.push('');
      lines.push('=== TEAM ROSTERS ===');
      teams.forEach((team) => {
        const teamPicks = picks.filter((p) => p.team_id === team.id && p.player_id);
        lines.push(`\n${team.name}:`);
        if (teamPicks.length === 0) {
          lines.push('  (No picks)');
        } else {
          teamPicks.forEach((p) => {
            const pl = playerMap.get(p.player_id!);
            lines.push(`  R${p.round}.${p.pick_in_round} - ${pl?.name || 'Unknown'}${pl?.primary_position ? ` (${pl.primary_position})` : ''}`);
          });
        }
      });

      const body = lines.join('\n');

      // Use Supabase Edge Function or mailto fallback
      // For now, use mailto as a reliable client-side approach
      const subject = encodeURIComponent(`Draft Board Results: ${draft.name}`);
      const mailBody = encodeURIComponent(body);
      window.open(`mailto:${emailAddress}?subject=${subject}&body=${mailBody}`, '_blank');

      setEmailSent(true);
      setTimeout(() => {
        setEmailSent(false);
        setShowExportModal(false);
        setExportMode('choose');
        setEmailAddress('');
      }, 2000);
    } catch (err) {
      console.error('Email error:', err);
    } finally {
      setEmailSending(false);
    }
  }, [emailAddress, draft, teams, players, picks, tradeLog]);

  // CSV export
  const handleExportCSV = useCallback(() => {
    if (!draft) return;
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const playerMap = new Map(players.map((p) => [p.id, p]));

    const csvRows: string[] = [];
    csvRows.push('Pick #,Round,Pick in Round,Team,Player,Position');

    picks.forEach((pick) => {
      const team = teamMap.get(pick.team_id);
      const player = pick.player_id ? playerMap.get(pick.player_id) : null;
      const row = [
        pick.pick_number,
        pick.round,
        pick.pick_in_round,
        `"${(team?.name || 'Unknown').replace(/"/g, '""')}"`,
        `"${(player?.name || '').replace(/"/g, '""')}"`,
        `"${(player?.primary_position || '').replace(/"/g, '""')}"`,
      ].join(',');
      csvRows.push(row);
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${draft.name.replace(/[^a-zA-Z0-9]/g, '_')}_draft_results.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowExportModal(false);
    setExportMode('choose');
  }, [draft, teams, players, picks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-8 bg-[var(--color-bg-secondary)] rounded w-3/4 mx-auto" />
          <div className="h-64 bg-[var(--color-bg-secondary)] rounded" />
        </div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Draft not found'}</p>
          <button onClick={() => router.push('/dashboard')} className="btn-primary rounded-lg">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const isPlanMode = mode === 'plan';
  const planOverlayActive = isPlanMode && (planSelectedPickId !== null || planSelectedPlayerId !== null);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Toolbar */}
      <div className="sticky top-0 z-40 bg-[var(--color-card)] border-b border-[var(--color-border)] shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors">
              <svg className="w-5 h-5 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold truncate">{draft.name}</h1>
          </div>

          {/* Center: Mode selector + Timer */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-[var(--color-bg-secondary)] p-1 rounded-lg">
              {(['draft', 'edit', 'trade', 'plan'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => { setMode(key); cancelPlanSelection(); }}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors capitalize ${
                    mode === key ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >{key}</button>
              ))}
            </div>
            {draft.timer_seconds > 0 && (
              <div className="flex items-center bg-[var(--color-bg-secondary)] p-1 rounded-lg">
                <DraftTimer seconds={timerSeconds} running={timerRunning} onRunningChange={setTimerRunning} onSecondsChange={setTimerSeconds} totalSeconds={draft.timer_seconds} />
              </div>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Undo */}
            <button onClick={handleUndo} disabled={undoStack.length === 0} title="Undo"
              className={`p-2 rounded-lg transition-colors ${undoStack.length === 0 ? 'text-[var(--color-border)] cursor-not-allowed' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'}`}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" /></svg>
            </button>

            {/* Player List */}
            <button onClick={() => { setShowPlayerListModal(true); setPlayerListSearch(''); }} title="Full Player List"
              className="p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </button>

            {/* Trade Log */}
            <button onClick={() => setShowTradeLogModal(true)} title="Trade Log"
              className={`relative p-2 rounded-lg transition-colors ${tradeLog.length > 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'} hover:bg-[var(--color-bg-secondary)]`}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              {tradeLog.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--color-primary)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{tradeLog.length}</span>
              )}
            </button>

            {/* Export */}
            <button onClick={() => { setShowExportModal(true); setExportMode('choose'); }} title="Export Draft"
              className="p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>

            {/* Eye toggle */}
            <button onClick={() => setShowNotes(!showNotes)} title={showNotes ? 'Hide plans' : 'Show plans'}
              className={`p-2 rounded-lg transition-colors ${showNotes ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'}`}>
              {showNotes ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>

            {/* Settings gear */}
            <button onClick={() => setShowSettings(true)} title="Settings"
              className="p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Plan mode overlay banner */}
      {planOverlayActive && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-start justify-center pt-24 pointer-events-none">
          <div className="pointer-events-auto bg-[var(--color-card)] border border-[var(--color-primary)] rounded-xl px-6 py-4 shadow-2xl text-center max-w-md">
            <p className="text-lg font-semibold text-[var(--color-text)] mb-2">
              {planSelectedPickId ? 'Now select a player from the list' : 'Now click a pick on the board'}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              {planSelectedPickId
                ? 'Click a player in the panel to assign them to this pick as your plan.'
                : 'Click an empty pick cell on the board to plan this player there.'}
            </p>
            <button onClick={cancelPlanSelection}
              className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={playerListPosition === 'side' ? 'flex gap-4 p-4 min-h-[calc(100vh-73px)]' : 'flex flex-col gap-4 p-4 min-h-[calc(100vh-73px)]'}>
        {/* Side player panel */}
        {playerListPosition === 'side' && (
          <div className="w-80 flex-shrink-0 bg-[var(--color-card)] rounded-lg border border-[var(--color-border)] overflow-y-auto max-h-[calc(100vh-120px)] relative z-40">
            <PlayerPanel
              players={players}
              mode={mode}
              picks={picks}
              plans={plans}
              layout="side"
              planSelectedPlayerId={isPlanMode ? planSelectedPlayerId : null}
              onPlayerPicked={
                mode === 'draft' ? handlePlayerPicked
                : isPlanMode ? handlePlanPlayerClick
                : undefined
              }
            />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="flex-1 bg-[var(--color-card)] rounded-lg p-4 border border-[var(--color-border)] overflow-auto relative z-40">
            <DraftGrid
              draft={draft} teams={teams} picks={picks} players={players} plans={plans}
              mode={mode} currentPickIndex={currentPickIndex} showNotes={showNotes}
              onPlayerPicked={mode === 'draft' ? handlePlayerPicked : undefined}
              onEditMove={mode === 'edit' ? handleEditMove : undefined}
              onEditRemove={mode === 'edit' ? handleEditRemove : undefined}
              onPlanAdd={isPlanMode ? handlePlanAdd : undefined}
              onPlanRemove={isPlanMode ? handlePlanRemove : undefined}
              onPlanPickClick={isPlanMode ? handlePlanPickClick : undefined}
              onPlayerDropped={mode === 'edit' ? handlePlayerDropped : undefined}
              planSelectedPickId={isPlanMode ? planSelectedPickId : null}
            />
          </div>

          {playerListPosition === 'bottom' && (
            <div className="h-56 bg-[var(--color-card)] rounded-lg border border-[var(--color-border)] overflow-hidden relative z-40">
              <PlayerPanel
                players={players} mode={mode} picks={picks} plans={plans} layout="bottom"
                planSelectedPlayerId={isPlanMode ? planSelectedPlayerId : null}
                onPlayerPicked={
                  mode === 'draft' ? handlePlayerPicked
                  : isPlanMode ? handlePlanPlayerClick
                  : undefined
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Trade overlay */}
      {mode === 'trade' && (
        <TradePanel teams={teams} picks={picks} players={players} tradeLog={tradeLog} onConfirmTrade={handleConfirmTrade} onCancel={() => setMode('draft')} />
      )}

      {/* Settings */}
      <SettingsModal
        isOpen={showSettings} onClose={() => setShowSettings(false)}
        playerListPosition={playerListPosition} onPlayerListPositionChange={(pos) => setPlayerListPosition(pos)}
        draft={draft} onDraftUpdate={setDraft} onResetBoard={handleResetBoard}
      />

      {/* Player List Modal */}
      {showPlayerListModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPlayerListModal(false)}>
          <div className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-bold text-[var(--color-text)]">All Players</h2>
              <button onClick={() => setShowPlayerListModal(false)} className="p-1 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-3 border-b border-[var(--color-border)]">
              <input
                type="text" placeholder="Search players..." value={playerListSearch}
                onChange={(e) => setPlayerListSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {players
                  .filter((p) => !playerListSearch || p.name.toLowerCase().includes(playerListSearch.toLowerCase()))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((player) => {
                    const draftedPick = player.is_drafted ? picks.find((pk) => pk.player_id === player.id) : null;
                    const draftedTeam = draftedPick ? teams.find((t) => t.id === draftedPick.team_id) : null;
                    return (
                      <div key={player.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${player.is_drafted ? 'opacity-40 border-[var(--color-border)]' : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'}`}>
                        {draftedTeam && (
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: draftedTeam.color || 'var(--color-text-secondary)' }} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${player.is_drafted ? 'line-through text-[var(--color-text-secondary)]' : 'text-[var(--color-text)]'}`}>
                            {player.name}
                          </p>
                          <div className="flex items-center gap-1">
                            {player.primary_position && (
                              <span className="text-[9px] text-[var(--color-text-secondary)]">{player.primary_position}</span>
                            )}
                            {draftedTeam && (
                              <span className="text-[9px] font-medium" style={{ color: draftedTeam.color || 'var(--color-text-secondary)' }}>{draftedTeam.name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            <div className="px-6 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] text-center">
              {players.filter((p) => !p.is_drafted).length} available / {players.filter((p) => p.is_drafted).length} drafted
            </div>
          </div>
        </div>
      )}

      {/* Trade Log Modal */}
      {showTradeLogModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTradeLogModal(false)}>
          <div className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-bold text-[var(--color-text)]">Trade Log</h2>
              <button onClick={() => setShowTradeLogModal(false)} className="p-1 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {tradeLog.length === 0 ? (
                <p className="text-center text-[var(--color-text-secondary)] py-8">No trades have been made yet.</p>
              ) : (
                <div className="space-y-3">
                  {tradeLog.map((entry, idx) => (
                    <div key={entry.id || idx} className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-[var(--color-text)]">Trade #{tradeLog.length - idx}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="space-y-1">
                        {entry.moves.map((move, mi) => (
                          <p key={mi} className="text-sm text-[var(--color-text-secondary)]">
                            <span className="font-medium text-[var(--color-text)]">{move.pickLabel}</span>{' '}{move.fromTeam} &rarr; {move.toTeam}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowExportModal(false); setExportMode('choose'); }}>
          <div className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--color-text)]">
                {exportMode === 'choose' ? 'Export Draft' : 'Export via Email'}
              </h2>
              <button onClick={() => { setShowExportModal(false); setExportMode('choose'); }} className="p-1 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {exportMode === 'choose' ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">Choose how to export your draft results.</p>
                <button onClick={handleExportCSV}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all text-left group">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">Download CSV</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">Save as a spreadsheet file</p>
                  </div>
                </button>
                <button onClick={() => setExportMode('email')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all text-left group">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">Send via Email</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">Email draft results to yourself or others</p>
                  </div>
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => setExportMode('choose')} className="flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline mb-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  Send a copy of the current draft board results to an email address.
                </p>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none mb-4"
                />
                <div className="flex gap-3">
                  <button onClick={() => setExportMode('choose')}
                    className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-secondary)] transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={!emailAddress.trim() || emailSending}
                    className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: emailSent ? '#16A34A' : 'var(--color-primary)' }}
                  >
                    {emailSending ? 'Sending...' : emailSent ? 'Sent!' : 'Send Email'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
