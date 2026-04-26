'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DraftBoard, DraftTeam, DraftPick, DraftPlayer, DraftPlan, DraftMode } from '@/lib/types';

interface DraftGridProps {
  draft: DraftBoard;
  teams: DraftTeam[];
  picks: DraftPick[];
  players: DraftPlayer[];
  plans: DraftPlan[];
  currentPickIndex: number;
  mode: DraftMode;
  showNotes: boolean;
  onPlayerPicked?: (playerId: string) => void;
  onEditMove?: (fromPickId: string, toPickId: string) => void;
  onEditRemove?: (pickId: string) => void;
  onPlanAdd?: (pickId: string, playerName: string) => void;
  onPlanRemove?: (planId: string) => void;
  onPlanPickClick?: (pickId: string) => void;
  onPlayerDropped?: (playerId: string, pickId: string) => void;
  planSelectedPickId?: string | null;
}

export function DraftGrid({
  draft,
  teams,
  picks,
  players,
  plans,
  currentPickIndex,
  mode,
  showNotes,
  onPlayerPicked,
  onEditMove,
  onEditRemove,
  onPlanAdd,
  onPlanRemove,
  onPlanPickClick,
  onPlayerDropped,
  planSelectedPickId,
}: DraftGridProps) {
  const [draggedPickId, setDraggedPickId] = useState<string | null>(null);
  const [dragOverPickId, setDragOverPickId] = useState<string | null>(null);
  const [editSelectedPickId, setEditSelectedPickId] = useState<string | null>(null);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const plansByPick = useMemo(() => {
    const map = new Map<string, DraftPlan>();
    plans.forEach((p) => map.set(p.pick_id, p));
    return map;
  }, [plans]);

  const currentPick = picks[currentPickIndex] || null;

  const numTeams = teams.length;
  const totalRounds = numTeams > 0 ? Math.ceil(picks.length / numTeams) : 0;

  // Group picks by team -- each column is locked to a team regardless of pick numbers
  const picksByTeam = useMemo(() => {
    const map = new Map<string, DraftPick[]>();
    teams.forEach((t) => map.set(t.id, []));
    picks.forEach((p) => {
      const arr = map.get(p.team_id);
      if (arr) arr.push(p);
    });
    // Sort each team's picks by pick_number
    map.forEach((arr) => arr.sort((a, b) => a.pick_number - b.pick_number));
    return map;
  }, [picks, teams]);

  const rounds = useMemo(() => {
    const result: (DraftPick | null)[][] = [];
    for (let r = 0; r < totalRounds; r++) {
      const roundPicks: (DraftPick | null)[] = [];
      for (let t = 0; t < numTeams; t++) {
        const teamId = teams[t].id;
        const teamPicks = picksByTeam.get(teamId) || [];
        roundPicks.push(teamPicks[r] || null);
      }
      result.push(roundPicks);
    }
    return result;
  }, [picksByTeam, numTeams, totalRounds, teams]);

  const hexToRgba = (color: string | null, alpha: number): string => {
    if (!color || !color.startsWith('#')) return 'transparent';
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, pickId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/pick-id', pickId);
    setDraggedPickId(pickId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (mode !== 'edit') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, toPickId: string) => {
    e.preventDefault();
    if (mode !== 'edit') return;
    const playerId = e.dataTransfer.getData('application/player-id');
    if (playerId && onPlayerDropped) {
      onPlayerDropped(playerId, toPickId);
      setDraggedPickId(null);
      setDragOverPickId(null);
      return;
    }
    const fromPickId = e.dataTransfer.getData('application/pick-id');
    if (fromPickId && fromPickId !== toPickId && onEditMove) {
      onEditMove(fromPickId, toPickId);
    }
    setDraggedPickId(null);
    setDragOverPickId(null);
  };

  const handleCellClick = (pick: DraftPick) => {
    if (mode === 'plan' && onPlanPickClick) {
      onPlanPickClick(pick.id);
      return;
    }
    if (mode === 'edit' && onEditMove) {
      const player = pick.player_id ? playerMap.get(pick.player_id) : null;
      if (editSelectedPickId === null) {
        if (player) setEditSelectedPickId(pick.id);
      } else {
        if (editSelectedPickId !== pick.id) onEditMove(editSelectedPickId, pick.id);
        setEditSelectedPickId(null);
      }
    }
  };

  // Spring transition matching the draft order page
  const cellSpring = {
    layout: { type: 'spring' as const, stiffness: 500, damping: 35 },
    opacity: { duration: 0.2 },
    scale: { duration: 0.15 },
  };

  return (
    <div className="w-full overflow-x-auto">
      {mode === 'edit' && (
        <div className="mb-3 px-4 py-2 rounded-lg text-sm font-medium text-center"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff', opacity: 0.85 }}>
          {editSelectedPickId
            ? 'Now click a destination cell to move the player (or click same cell to cancel)'
            : 'Click a drafted player to select, then click where to move them. Or drag and drop players from the list.'}
        </div>
      )}

      <table className="w-full border-collapse" style={{ minWidth: `${numTeams * 150 + 60}px` }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-14 p-2 text-xs font-bold uppercase tracking-wider text-center"
              style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', borderBottom: '3px solid var(--color-border)' }}>
              RD
            </th>
            {teams.map((team) => (
              <th key={team.id} className="p-3 text-center font-bold text-sm uppercase tracking-wider"
                style={{ backgroundColor: team.color || 'var(--color-primary)', color: '#ffffff', borderBottom: '3px solid var(--color-border)', minWidth: '140px', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                {team.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((roundPicks, roundIdx) => (
            <tr key={roundIdx}>
              <td className="sticky left-0 z-10 p-2 text-center font-bold text-sm"
                style={{ backgroundColor: roundIdx % 2 === 0 ? 'var(--color-card)' : 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', borderRight: '2px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
                {roundIdx + 1}
              </td>
              {roundPicks.map((pick, colIdx) => {
                if (!pick) {
                  return <td key={`empty-${roundIdx}-${colIdx}`} className="p-1" style={{ borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}><div className="rounded-md p-2 min-h-[60px]" /></td>;
                }
                const player = pick.player_id ? playerMap.get(pick.player_id) : null;
                const plan = plansByPick.get(pick.id);
                const isCurrent = currentPick?.id === pick.id;
                const isDragSource = draggedPickId === pick.id;
                const isDragOver = dragOverPickId === pick.id && mode === 'edit';
                const isEditSelected = editSelectedPickId === pick.id;
                const isPlanSelected = planSelectedPickId === pick.id;
                const isDraggable = mode === 'edit' && !!player;
                const team = teams.find((t) => t.id === pick.team_id);
                const teamColor = team?.color || '#8B5CF6';
                const cellBg = isCurrent ? hexToRgba(teamColor, 0.3) : player ? hexToRgba(teamColor, 0.15) : hexToRgba(teamColor, 0.05);

                return (
                  <td key={pick.id} className="p-1" style={{ borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
                    <div
                      draggable={isDraggable}
                      onDragStart={(e) => handleDragStart(e, pick.id)}
                      onDragOver={(e) => { handleDragOver(e); setDragOverPickId(pick.id); }}
                      onDragLeave={() => setDragOverPickId(null)}
                      onDrop={(e) => handleDrop(e, pick.id)}
                      onDragEnd={() => { setDraggedPickId(null); setDragOverPickId(null); }}
                      onClick={() => handleCellClick(pick)}
                      className={`relative rounded-md p-2 min-h-[60px] transition-shadow duration-150 ${isDraggable ? 'cursor-grab active:cursor-grabbing' : mode === 'edit' || mode === 'plan' ? 'cursor-pointer' : ''} ${isDragOver ? 'ring-2 ring-blue-400' : ''} ${isEditSelected ? 'ring-2 ring-yellow-400' : ''} ${isPlanSelected ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
                      style={{
                        backgroundColor: isDragOver ? hexToRgba('#3b82f6', 0.15) : cellBg,
                        borderLeft: `4px solid ${teamColor}`,
                        border: isCurrent ? `2px solid ${teamColor}` : isEditSelected ? '2px solid #facc15' : isPlanSelected ? '2px solid var(--color-primary)' : isDragOver ? '2px dashed #3b82f6' : `1px solid ${hexToRgba(teamColor, 0.2)}`,
                        boxShadow: isCurrent ? `0 0 12px ${hexToRgba(teamColor, 0.4)}` : isDragOver ? '0 0 16px rgba(59, 130, 246, 0.3)' : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold" style={{ color: hexToRgba(teamColor, 0.6) }}>#{pick.pick_number}</span>
                        {mode === 'edit' && player && onEditRemove && (
                          <button onClick={(e) => { e.stopPropagation(); onEditRemove(pick.id); }} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-500/20 transition-colors">
                            <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          </button>
                        )}
                      </div>

                      {/* Animated player content — springs in/out when players move between cells */}
                      <AnimatePresence mode="wait">
                        {player ? (
                          <motion.div
                            key={player.id}
                            layout
                            initial={{ opacity: 0, scale: 0.8, y: 6 }}
                            animate={{
                              opacity: isDragSource ? 0.3 : 1,
                              scale: isDragSource ? 0.9 : 1,
                              y: 0,
                            }}
                            exit={{ opacity: 0, scale: 0.8, y: -6 }}
                            transition={cellSpring}
                            className="flex flex-col"
                          >
                            <span className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--color-text)' }}>{player.name}</span>
                            {player.primary_position && (<span className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{player.primary_position}</span>)}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center justify-center min-h-[28px]"
                          >
                            {isCurrent ? (
                              <span className="text-xs font-bold" style={{ color: teamColor, animation: 'draftPulse 2s ease-in-out infinite' }}>On the clock</span>
                            ) : (
                              <span className="text-[10px] opacity-30" style={{ color: 'var(--color-text-secondary)' }}>{'—'}</span>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {plan && showNotes && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] italic text-[var(--color-primary)] truncate flex-1">Plan: {plan.player_name}</span>
                          {mode === 'plan' && onPlanRemove && (
                            <button onClick={(e) => { e.stopPropagation(); onPlanRemove(plan.id); }} className="ml-1 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-red-500/20">
                              <svg className="w-2.5 h-2.5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes draftPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}} />
    </div>
  );
}

export default DraftGrid;
