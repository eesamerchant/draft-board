"use client";

import { useState, useMemo } from "react";
import type { DraftTeam, DraftPick, DraftPlayer } from "@/lib/types";

export interface TradeLogEntry {
  id: string;
  timestamp: string;
  teams: string[];
  moves: { pickLabel: string; fromTeam: string; toTeam: string }[];
}

interface TradePanelProps {
  teams: DraftTeam[];
  picks: DraftPick[];
  players: DraftPlayer[];
  tradeLog: TradeLogEntry[];
  onConfirmTrade: (trade: {
    picksFromA: string[];
    picksFromB: string[];
    teamAId: string;
    teamBId: string;
  }) => void;
  onCancel: () => void;
}

export default function TradePanel({
  teams,
  picks,
  players,
  tradeLog,
  onConfirmTrade,
  onCancel,
}: TradePanelProps) {
  const [teamA, setTeamA] = useState<string>(teams[0]?.id || "");
  const [teamB, setTeamB] = useState<string>(teams[1]?.id || "");
  const [selectedA, setSelectedA] = useState<Set<string>>(new Set());
  const [selectedB, setSelectedB] = useState<Set<string>>(new Set());

  const getTeamName = (id: string) => teams.find((t) => t.id === id)?.name || "Unknown";
  const getTeamColor = (id: string) => teams.find((t) => t.id === id)?.color || "#8B5CF6";

  const picksForTeamA = useMemo(
    () => picks.filter((p) => p.team_id === teamA).sort((a, b) => a.pick_number - b.pick_number),
    [picks, teamA]
  );

  const picksForTeamB = useMemo(
    () => picks.filter((p) => p.team_id === teamB).sort((a, b) => a.pick_number - b.pick_number),
    [picks, teamB]
  );

  const getPickLabel = (pick: DraftPick): { main: string; sub: string } => {
    const player = pick.player_id ? players.find((p) => p.id === pick.player_id) : null;
    if (player) {
      return { main: player.name, sub: `R${pick.round}.${pick.pick_in_round} (#${pick.pick_number})` };
    }
    return { main: `Pick #${pick.pick_number}`, sub: `R${pick.round}.${pick.pick_in_round}` };
  };

  const toggleSelect = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFn(next);
  };

  const canConfirm = selectedA.size > 0 && selectedB.size > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirmTrade({
      picksFromA: Array.from(selectedA),
      picksFromB: Array.from(selectedB),
      teamAId: teamA,
      teamBId: teamB,
    });
    setSelectedA(new Set());
    setSelectedB(new Set());
  };

  const renderTeamColumn = (
    teamId: string,
    teamPicks: DraftPick[],
    selected: Set<string>,
    setSelected: (s: Set<string>) => void,
    label: string,
    otherTeamId: string,
    setTeam: (id: string) => void
  ) => {
    const color = getTeamColor(teamId);
    return (
      <div className="flex-1 min-w-[220px]">
        <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">
          {label}
          {selected.size > 0 && (
            <span className="ml-2 text-xs font-normal text-[var(--color-primary)]">
              ({selected.size} selected)
            </span>
          )}
        </label>
        <select
          value={teamId}
          onChange={(e) => { setTeam(e.target.value); setSelected(new Set()); }}
          className="w-full px-3 py-2 mb-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
        >
          {teams.filter((t) => t.id !== otherTeamId).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {teamPicks.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] py-4 text-center">No picks</p>
          ) : (
            teamPicks.map((pick) => {
              const isSelected = selected.has(pick.id);
              const labels = getPickLabel(pick);
              const hasPlayer = !!pick.player_id;
              return (
                <button
                  key={pick.id}
                  onClick={() => toggleSelect(selected, setSelected, pick.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all text-sm ${
                    isSelected
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                      : "border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-secondary)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)]"
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${hasPlayer ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"}`}>
                        {labels.main}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-secondary)]">{labels.sub}</p>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderPreview = () => {
    if (!canConfirm) return null;
    const teamAName = getTeamName(teamA);
    const teamBName = getTeamName(teamB);
    const colorA = getTeamColor(teamA);
    const colorB = getTeamColor(teamB);

    const describeItem = (id: string) => {
      const pick = picks.find((p) => p.id === id);
      if (!pick) return "?";
      const player = pick.player_id ? players.find((p) => p.id === pick.player_id) : null;
      return player ? `${player.name} (R${pick.round}.${pick.pick_in_round})` : `Pick #${pick.pick_number}`;
    };

    const itemsFromA = Array.from(selectedA).map(describeItem);
    const itemsFromB = Array.from(selectedB).map(describeItem);

    return (
      <div className="mt-4 p-4 rounded-lg border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary)]/5">
        <p className="text-sm font-semibold text-[var(--color-text)] mb-3">Trade Preview</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: colorA }}>{teamAName} sends:</p>
            {itemsFromA.map((item, i) => (
              <p key={i} className="text-sm text-[var(--color-text-secondary)] pl-3">{item}</p>
            ))}
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: colorB }}>{teamBName} sends:</p>
            {itemsFromB.map((item, i) => (
              <p key={i} className="text-sm text-[var(--color-text-secondary)] pl-3">{item}</p>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Trade Manager</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Select picks and/or players from each team to trade. You can select multiple items per side.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex gap-6">
            {renderTeamColumn(teamA, picksForTeamA, selectedA, setSelectedA, "Team A", teamB, setTeamA)}

            <div className="flex items-center justify-center">
              <div className="p-3 rounded-full bg-[var(--color-bg-secondary)]">
                <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
            </div>

            {renderTeamColumn(teamB, picksForTeamB, selectedB, setSelectedB, "Team B", teamA, setTeamB)}
          </div>

          {renderPreview()}
        </div>

        <div className="px-6 py-4 border-t border-[var(--color-border)] flex justify-end gap-3">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-secondary)] transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={!canConfirm}
            className="px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: canConfirm ? "var(--color-primary)" : "var(--color-border)" }}>
            Confirm Trade
          </button>
        </div>
      </div>
    </div>
  );
}
