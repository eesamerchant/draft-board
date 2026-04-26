"use client";

import React, { useState, useMemo } from "react";
import type { DraftPlayer, DraftPick, DraftPlan, DraftMode } from "@/lib/types";

interface PlayerPanelProps {
  players: DraftPlayer[];
  mode: DraftMode;
  picks: DraftPick[];
  plans: DraftPlan[];
  onPlayerPicked?: (playerId: string) => void;
  onPlanAdd?: (pickId: string, playerName: string) => void;
  layout?: "side" | "bottom";
  planSelectedPlayerId?: string | null;
}

type SortType = "name" | "ranking";
type SortDirection = "asc" | "desc";

export default function PlayerPanel({
  players, mode, picks, plans, onPlayerPicked, onPlanAdd, layout = "side", planSelectedPlayerId,
}: PlayerPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDrafted, setShowDrafted] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [sortType, setSortType] = useState<SortType>("name");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  const hasRankings = useMemo(() => players.some((p) => p.ranking != null), [players]);
  const positions = useMemo(() => {
    const posSet = new Set<string>();
    players.forEach((p) => { if (p.primary_position) posSet.add(p.primary_position); if (p.secondary_position) posSet.add(p.secondary_position); });
    return Array.from(posSet).sort();
  }, [players]);
  const hasPositions = positions.length > 0;
  const hasAnyFilters = hasRankings || hasPositions;
  const undraftedPlayers = useMemo(() => players.filter((p) => !p.is_drafted), [players]);

  const filteredPlayers = useMemo(() => {
    let result = showDrafted ? players : undraftedPlayers;
    if (searchQuery) result = result.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (selectedPosition) result = result.filter((p) => p.primary_position === selectedPosition || p.secondary_position === selectedPosition);
    result = [...result].sort((a, b) => {
      let aVal: string | number = ""; let bVal: string | number = "";
      if (sortType === "name") { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
      else if (sortType === "ranking") { aVal = a.ranking ?? Number.MAX_VALUE; bVal = b.ranking ?? Number.MAX_VALUE; }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [players, undraftedPlayers, showDrafted, searchQuery, sortType, sortDirection, selectedPosition]);

  const toggleAlphaSort = () => { if (sortType === "name") setSortDirection(sortDirection === "asc" ? "desc" : "asc"); else { setSortType("name"); setSortDirection("asc"); } };
  const handleRankingSort = () => { if (sortType === "ranking") setSortDirection(sortDirection === "asc" ? "desc" : "asc"); else { setSortType("ranking"); setSortDirection("asc"); } };
  const handlePlayerClick = (player: DraftPlayer) => { if (player.is_drafted) return; if ((mode === "draft" || mode === "plan") && onPlayerPicked) onPlayerPicked(player.id); };
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, player: DraftPlayer) => { if (mode !== "edit" || player.is_drafted) return; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("application/player-id", player.id); e.dataTransfer.setData("text/plain", player.name); };

  if (layout === "bottom") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] flex-shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-text)] whitespace-nowrap">Players <span className="text-[var(--color-text-secondary)] font-normal">({undraftedPlayers.length})</span></h2>
          <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none" />
          <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap"><input type="checkbox" checked={showDrafted} onChange={(e) => setShowDrafted(e.target.checked)} className="w-3.5 h-3.5 rounded" /><span className="text-xs text-[var(--color-text-secondary)]">Drafted</span></label>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {filteredPlayers.length === 0 ? (<div className="flex items-center justify-center text-[var(--color-text-secondary)] text-sm px-4 py-4">No players found</div>) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
              {filteredPlayers.map((player, idx) => {
                const isDrafted = player.is_drafted;
                const isClickable = !isDrafted && (mode === "draft" || mode === "plan") && !!onPlayerPicked;
                const isDraggableEdit = mode === "edit" && !isDrafted;
                const isPlanSelected = planSelectedPlayerId === player.id;
                return (
                  <div key={`${player.id}-${idx}`} draggable={isDraggableEdit} onDragStart={(e) => handleDragStart(e, player)} onClick={() => isClickable && handlePlayerClick(player)}
                    className={`px-2.5 py-1.5 rounded-lg border transition-colors ${isPlanSelected ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15 ring-2 ring-[var(--color-primary)]" : isDrafted ? "opacity-40 border-[var(--color-border)]" : isDraggableEdit ? "border-[var(--color-border)] hover:border-blue-400 cursor-grab active:cursor-grabbing hover:bg-blue-500/5" : isClickable ? "border-[var(--color-border)] hover:border-[var(--color-primary)] cursor-pointer hover:bg-[var(--color-primary)]/5" : "border-[var(--color-border)]"}`}
                    style={{ backgroundColor: isPlanSelected ? undefined : "var(--color-bg-secondary)" }}>
                    <p className={`font-medium text-sm truncate ${isDrafted ? "line-through" : ""}`} style={{ color: "var(--color-text)" }}>{player.name}</p>
                    <div className="flex items-center gap-1">
                      {player.primary_position && (<span className="text-[9px] text-[var(--color-text-secondary)]">{player.primary_position}</span>)}
                      {player.ranking != null && (<span className="text-[9px] font-semibold text-[var(--color-primary)]">#{player.ranking}</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Available Players<span className="ml-2 text-sm font-normal text-[var(--color-text-secondary)]">({undraftedPlayers.length})</span></h2>
        {mode === "edit" && (<p className="text-xs text-blue-400 mt-1">Drag players onto the board to place them</p>)}
      </div>
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <input type="text" placeholder="Search players..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none" />
      </div>
      <div className="px-4 py-3 border-b border-[var(--color-border)] space-y-3">
        <div className="flex gap-2">
          <button onClick={toggleAlphaSort} className={`flex items-center gap-1 px-3 py-2 text-sm rounded-lg border transition-colors ${sortType === "name" ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]" : "bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}>
            A-Z<svg className={`w-4 h-4 transition-transform ${sortType === "name" && sortDirection === "desc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" /></svg>
          </button>
          {hasAnyFilters && (<button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1 px-3 py-2 text-sm rounded-lg border transition-colors ${showFilters ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]" : "bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}>Filters<svg className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg></button>)}
        </div>
        {showFilters && hasAnyFilters && (
          <div className="space-y-3 pt-3 border-t border-[var(--color-border)]">
            {hasRankings && (<div><p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Sort by Ranking</p><button onClick={handleRankingSort} className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors ${sortType === "ranking" ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]" : "bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}>Ranking {sortType === "ranking" && (sortDirection === "asc" ? "\u2191" : "\u2193")}</button></div>)}
            {hasPositions && (<div><p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Filter by Position</p><div className="flex flex-wrap gap-2"><button onClick={() => setSelectedPosition(null)} className={`px-3 py-1 text-xs rounded-full border transition-colors ${selectedPosition === null ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white" : "bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}>All</button>{positions.map((pos) => (<button key={pos} onClick={() => setSelectedPosition(selectedPosition === pos ? null : pos)} className={`px-3 py-1 text-xs rounded-full border transition-colors ${selectedPosition === pos ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white" : "bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}>{pos}</button>))}</div></div>)}
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showDrafted} onChange={(e) => setShowDrafted(e.target.checked)} className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" /><span className="text-sm text-[var(--color-text-secondary)]">Show drafted players</span></label>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredPlayers.length === 0 ? (<div className="flex items-center justify-center h-32 text-[var(--color-text-secondary)] text-sm">No players found</div>) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filteredPlayers.map((player, idx) => {
              const isDrafted = player.is_drafted;
              const isClickable = !isDrafted && (mode === "draft" || mode === "plan") && !!onPlayerPicked;
              const isDraggableEdit = mode === "edit" && !isDrafted;
              const isPlanSelected = planSelectedPlayerId === player.id;
              return (
                <div key={`${player.id}-${idx}`} draggable={isDraggableEdit} onDragStart={(e) => handleDragStart(e, player)} onClick={() => isClickable && handlePlayerClick(player)}
                  className={`px-4 py-3 transition-colors ${isPlanSelected ? "bg-[var(--color-primary)]/15 ring-2 ring-inset ring-[var(--color-primary)]" : isDrafted ? "opacity-50" : isDraggableEdit ? "hover:bg-blue-500/5 cursor-grab active:cursor-grabbing" : isClickable ? "hover:bg-[var(--color-primary)]/5 cursor-pointer" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${isDrafted ? "line-through text-[var(--color-text-secondary)]" : "text-[var(--color-text)]"}`}>{player.name}</p>
                      {hasPositions && (<div className="flex flex-wrap gap-1 mt-1">{player.primary_position && (<span className="inline-block px-2 py-0.5 text-xs rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">{player.primary_position}</span>)}{player.secondary_position && (<span className="inline-block px-2 py-0.5 text-xs rounded bg-[var(--color-bg)] text-[var(--color-text-secondary)]">{player.secondary_position}</span>)}</div>)}
                    </div>
                    <div className="flex items-center gap-2">
                      {player.ranking != null && (<p className="text-sm font-semibold text-[var(--color-primary)]">#{player.ranking}</p>)}
                      {isDraggableEdit && (<svg className="w-4 h-4 text-blue-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
