'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import {
  DraftBoard,
  DraftTeam,
  DraftPlayer,
  SPORT_PRESETS,
  TEAM_COLORS,
  TeamColor,
} from '@/lib/types'

const supabase = createClient()

interface Team {
  id: string
  name: string
  color: string
}

interface PlayerWithRanking {
  name: string
  primary_position?: string
  secondary_position?: string
  ranking?: number
}

type DraftType = 'snake' | 'linear'
type DraftOrderType = 'randomize' | 'custom'
type DraftModeType = 'single' | 'live'

function DraftSetupPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const draftId = searchParams.get('id')

  // Draft settings state
  const [draftName, setDraftName] = useState('')
  const [timerEnabled, setTimerEnabled] = useState(true)
  const [timerMinutes, setTimerMinutes] = useState(5)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [numTeams, setNumTeams] = useState(2)
  const [maxPlayersPerTeam, setMaxPlayersPerTeam] = useState(5)
  const [teams, setTeams] = useState<Team[]>([])
  const [draftType, setDraftType] = useState<DraftType>('snake')
  const [draftOrderType, setDraftOrderType] = useState<DraftOrderType>('randomize')
  const [draftOrder, setDraftOrder] = useState<Team[]>([])
  const [playerNames, setPlayerNames] = useState('')
  const [playerCount, setPlayerCount] = useState(0)
  const [playerList, setPlayerList] = useState<PlayerWithRanking[]>([])
  const [enablePositions, setEnablePositions] = useState(false)
  const [sportPreset, setSportPreset] = useState<string>('nfl')
  const [positions, setPositions] = useState<string[]>([])
  const [tradeTime, setTradeTime] = useState(0)
  const [draftMode, setDraftMode] = useState<DraftModeType>('single')
  const [joinCode, setJoinCode] = useState('')
  const [isShuffling, setIsShuffling] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draggedTeam, setDraggedTeam] = useState<string | null>(null)
  const [showShortagePopup, setShowShortagePopup] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Get colors already used by other teams
  const getUsedColors = (excludeTeamId?: string): string[] => {
    return teams
      .filter(t => t.id !== excludeTeamId)
      .map(t => t.color)
  }

  // Get available colors for a team
  const getAvailableColors = (teamId: string): TeamColor[] => {
    const usedColors = getUsedColors(teamId)
    return TEAM_COLORS.filter(c => !usedColors.includes(c.hex))
  }

  // Load existing draft on mount
  useEffect(() => {
    if (!draftId) {
      router.push('/dashboard')
      return
    }

    const loadDraft = async () => {
      try {
        const { data, error } = await supabase
          .from('draft_boards')
          .select('*')
          .eq('id', draftId)
          .single()

        if (error) throw error

        if (data) {
          setDraftName(data.name || '')
          const totalSeconds = data.timer_seconds || 300
          if (totalSeconds === 0) {
            setTimerEnabled(false)
          } else {
            setTimerEnabled(true)
            setTimerMinutes(Math.floor(totalSeconds / 60))
            setTimerSeconds(totalSeconds % 60)
          }
          setNumTeams(data.num_teams || 2)
          setMaxPlayersPerTeam(data.max_players_per_team || 5)
          setDraftType(data.draft_type || 'snake')
          setDraftOrderType(data.draft_order_type || 'randomize')
          setTradeTime(data.trade_time_seconds || 0)
          setDraftMode(data.is_multiplayer ? 'live' : 'single')
          if (data.join_code) setJoinCode(data.join_code)
          setEnablePositions(data.sport_preset ? true : false)
          setSportPreset(data.sport_preset || 'nfl')

          // Load teams
          const { data: teamsData, error: teamsError } = await supabase
            .from('draft_board_teams')
            .select('*')
            .eq('draft_id', draftId)
            .order('draft_order', { ascending: true })

          if (!teamsError && teamsData && teamsData.length > 0) {
            const loadedTeams = teamsData.map((t: any) => ({
              id: t.id,
              name: t.name,
              color: t.color || TEAM_COLORS[0].hex,
            }))
            setTeams(loadedTeams)
            setDraftOrder(loadedTeams)
          }

          // Load players
          const { data: playersData, error: playersError } = await supabase
            .from('draft_board_players')
            .select('*')
            .eq('draft_id', draftId)

          if (!playersError && playersData && playersData.length > 0) {
            const names = playersData.map((p: any) => p.name).join('\n')
            setPlayerNames(names)
            parsePlayerNames(names)
            const enrichedPlayers = playersData.map((p: any) => ({
              name: p.name,
              primary_position: p.primary_position,
              secondary_position: p.secondary_position,
              ranking: p.ranking,
            }))
            setPlayerList(enrichedPlayers)
          }
        }
      } catch (error) {
        console.error('Failed to load draft:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDraft()
  }, [draftId, router])

  // Initialize teams when numTeams changes
  useEffect(() => {
    if (teams.length === 0 || teams.length !== numTeams) {
      const usedColors: string[] = []
      const newTeams = Array.from({ length: numTeams }, (_, i) => {
        const existingColor = teams[i]?.color
        let color: string
        if (existingColor && !usedColors.includes(existingColor)) {
          color = existingColor
        } else {
          // Find next unused color
          const available = TEAM_COLORS.find(c => !usedColors.includes(c.hex))
          color = available ? available.hex : TEAM_COLORS[i % TEAM_COLORS.length].hex
        }
        usedColors.push(color)
        return {
          id: teams[i]?.id || `team-${i}`,
          name: teams[i]?.name || `Team ${i + 1}`,
          color,
        }
      })
      setTeams(newTeams)
      setDraftOrder(newTeams)
    }
  }, [numTeams])

  // Parse player names
  const parsePlayerNames = (text: string) => {
    const names = text
      .split('\n')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
    setPlayerCount(names.length)
    const parsedPlayers = names.map((name) => ({ name }))
    setPlayerList(parsedPlayers)
  }

  const handlePlayerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPlayerNames(e.target.value)
    parsePlayerNames(e.target.value)
  }

  const handleDraftNameBlur = async () => {
    if (!draftId) return
    try {
      await supabase
        .from('draft_boards')
        .update({ name: draftName })
        .eq('id', draftId)
    } catch (error) {
      console.error('Failed to save draft name:', error)
    }
  }

  const handleTeamNameChange = (teamId: string, newName: string) => {
    const updatedTeams = teams.map((t) =>
      t.id === teamId ? { ...t, name: newName } : t
    )
    setTeams(updatedTeams)
    setDraftOrder(prev => prev.map((t) =>
      t.id === teamId ? { ...t, name: newName } : t
    ))
  }

  const handleTeamColorChange = (teamId: string, newColor: string) => {
    const updatedTeams = teams.map((t) =>
      t.id === teamId ? { ...t, color: newColor } : t
    )
    setTeams(updatedTeams)
    setDraftOrder(prev => prev.map((t) =>
      t.id === teamId ? { ...t, color: newColor } : t
    ))
  }

  const handleRandomizeDraftOrder = async () => {
    setIsShuffling(true)
    const shuffleInterval = setInterval(() => {
      const shuffled = [...draftOrder].sort(() => Math.random() - 0.5)
      setDraftOrder(shuffled)
    }, 100)

    await new Promise((resolve) => setTimeout(resolve, 2000))
    clearInterval(shuffleInterval)

    const shuffled = [...teams].sort(() => Math.random() - 0.5)
    setDraftOrder(shuffled)
    setIsShuffling(false)
  }

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, teamId: string) => {
    setDraggedTeam(teamId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetTeamId: string) => {
    e.preventDefault()
    if (!draggedTeam || draggedTeam === targetTeamId) {
      setDraggedTeam(null)
      setDragOverIndex(null)
      return
    }

    const draggedIndex = draftOrder.findIndex((t) => t.id === draggedTeam)
    const targetIndex = draftOrder.findIndex((t) => t.id === targetTeamId)

    // Remove dragged item and insert at target position (reorder, not swap)
    const newOrder = [...draftOrder]
    const [removed] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, removed)

    setDraftOrder(newOrder)
    setDraggedTeam(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedTeam(null)
    setDragOverIndex(null)
  }

  const handleSportPresetChange = (preset: string) => {
    setSportPreset(preset)
    if (preset === 'custom') {
      setPositions([])
    } else {
      const presetData = SPORT_PRESETS.find((p) => p.id === preset)
      if (presetData) {
        setPositions(presetData.positions)
      }
    }
  }

  const handleAddCustomPosition = (position: string) => {
    if (position && !positions.includes(position)) {
      setPositions([...positions, position])
    }
  }

  const handleRemovePosition = (position: string) => {
    setPositions(positions.filter((p) => p !== position))
  }

  const handleUpdatePlayer = (
    index: number,
    field: 'primary_position' | 'secondary_position' | 'ranking',
    value: string | number
  ) => {
    const updated = [...playerList]
    updated[index] = { ...updated[index], [field]: value }
    setPlayerList(updated)
  }

  // Validate and generate board
  const handleGenerateBoard = async () => {
    if (!draftId) return

    const totalPlayersNeeded = numTeams * maxPlayersPerTeam

    // Show popup if player count doesn't match
    if (playerCount !== totalPlayersNeeded) {
      setShowShortagePopup(true)
      return
    }

    await generateBoard()
  }

  const generateBoard = async () => {
    if (!draftId) return
    setSaving(true)
    setShowShortagePopup(false)

    try {
      // Use the current draft order (user may have dragged or shuffled)
      let finalOrder = [...draftOrder]

      const timerValue = timerEnabled ? (timerMinutes * 60 + timerSeconds) : 0

      // Update draft settings
      const { error: updateError } = await supabase
        .from('draft_boards')
        .update({
          name: draftName,
          timer_seconds: timerValue,
          num_teams: numTeams,
          max_players_per_team: maxPlayersPerTeam,
          draft_type: draftType,
          draft_order_type: 'custom',
          trade_time_seconds: tradeTime,
          is_multiplayer: draftMode === 'live',
          join_code: draftMode === 'live' ? joinCode : null,
          sport_preset: enablePositions ? sportPreset : null,
          status: 'active',
        })
        .eq('id', draftId)

      if (updateError) throw updateError

      // Delete existing teams, players, and picks
      await supabase.from('draft_board_picks').delete().eq('draft_id', draftId)
      await supabase.from('draft_board_players').delete().eq('draft_id', draftId)
      await supabase.from('draft_board_teams').delete().eq('draft_id', draftId)

      // Create teams
      const teamIds: { [key: string]: string } = {}
      for (let i = 0; i < finalOrder.length; i++) {
        const team = finalOrder[i]
        const { data, error } = await supabase
          .from('draft_board_teams')
          .insert({
            draft_id: draftId,
            name: team.name,
            color: team.color,
            draft_order: i,
          })
          .select()
          .single()

        if (error) throw error
        teamIds[team.id] = data.id
      }

      // Create players
      const createdPlayers: { [key: string]: string } = {}
      for (let i = 0; i < playerList.length; i++) {
        const player = playerList[i]
        const { data, error } = await supabase
          .from('draft_board_players')
          .insert({
            draft_id: draftId,
            name: player.name,
            primary_position: player.primary_position || null,
            secondary_position: player.secondary_position || null,
            ranking: player.ranking || null,
          })
          .select()
          .single()

        if (error) throw error
        createdPlayers[i] = data.id
      }

      // Generate draft picks based on draft type and order
      const picks: any[] = []
      let pickNumber = 1

      for (let round = 0; round < maxPlayersPerTeam; round++) {
        let teamOrder: number[] = Array.from({ length: numTeams }, (_, i) => i)

        if (draftType === 'snake' && round % 2 === 1) {
          teamOrder.reverse()
        }

        for (const teamIndex of teamOrder) {
          picks.push({
            draft_id: draftId,
            team_id: teamIds[finalOrder[teamIndex].id],
            player_id: null,
            pick_number: pickNumber,
            round: round + 1,
            pick_in_round: teamIndex + 1,
          })
          pickNumber++
        }
      }

      // Batch insert picks
      if (picks.length > 0) {
        const { error } = await supabase
          .from('draft_board_picks')
          .insert(picks)

        if (error) throw error
      }

      // Navigate to draft board
      router.push(`/draft/${draftId}`)
    } catch (error) {
      console.error('Failed to generate board:', error)
      alert('Failed to generate draft board. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const totalPlayersNeeded = numTeams * maxPlayersPerTeam
  const playerDifference = playerCount - totalPlayersNeeded

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">Loading draft...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Player Shortage Popup */}
      {showShortagePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-[var(--color-text)] mb-3">Player Count Mismatch</h3>
            <p className="text-[var(--color-text-secondary)] mb-4">
              {playerDifference > 0
                ? `You have ${playerDifference} extra player${playerDifference > 1 ? 's' : ''}. Some players won't be drafted.`
                : `You're short ${Math.abs(playerDifference)} player${Math.abs(playerDifference) > 1 ? 's' : ''}. Not all teams will be full.`}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Need {totalPlayersNeeded} players ({numTeams} teams × {maxPlayersPerTeam} per team), have {playerCount}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowShortagePopup(false)
                  textareaRef.current?.focus()
                  textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
                className="flex-1 px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-border)] text-[var(--color-text)] rounded-lg font-medium transition-colors"
              >
                Go Back & Edit
              </button>
              <button
                onClick={() => generateBoard()}
                className="flex-1 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-lg font-medium transition-colors"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text)]">Draft Setup</h1>
              <p className="text-[var(--color-text-secondary)] mt-1">Configure your draft board</p>
            </div>
            <Link
              href="/dashboard"
              className="text-[var(--color-primary)] hover:underline font-medium"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Section 1: Draft Name */}
          <div className="bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="px-6 py-4 border-l-4 border-[var(--color-primary)]">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Draft Name</h2>
            </div>
            <div className="px-6 py-4">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={handleDraftNameBlur}
                placeholder="Enter draft name..."
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Section 2: Timer Settings */}
          <div className="bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="px-6 py-4 border-l-4 border-[var(--color-primary)] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Timer Settings</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-[var(--color-text-secondary)]">{timerEnabled ? 'On' : 'Off'}</span>
                <div
                  onClick={() => setTimerEnabled(!timerEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${timerEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${timerEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </label>
            </div>
            {timerEnabled && (
              <div className="px-6 py-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={timerMinutes}
                      onChange={(e) => setTimerMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Seconds</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={timerSeconds}
                      onChange={(e) => setTimerSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                  Time per pick: {timerMinutes}:{String(timerSeconds).padStart(2, '0')}
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Teams */}
          <div className="bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="px-6 py-4 border-l-4 border-[var(--color-primary)]">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Teams</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Number of Teams (2-16)</label>
                  <input
                    type="number"
                    min="2"
                    max="16"
                    value={numTeams}
                    onChange={(e) => setNumTeams(Math.max(2, Math.min(16, parseInt(e.target.value) || 2)))}
                    className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Max Players per Team</label>
                  <input
                    type="number"
                    min="1"
                    value={maxPlayersPerTeam}
                    onChange={(e) => setMaxPlayersPerTeam(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium text-[var(--color-text)]">Team Names & Colors</h3>
                {teams.map((team, index) => {
                  const availableColors = getAvailableColors(team.id)
                  const currentColor = TEAM_COLORS.find(c => c.hex === team.color)
                  return (
                    <div key={team.id} className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-8 h-8 rounded-full border-2 flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: team.color, borderColor: team.color }}
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            value={team.name}
                            onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                            placeholder={`Team ${index + 1}`}
                            className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
                          />
                        </div>
                        <span className="text-xs text-[var(--color-text-secondary)] min-w-[60px] text-right">{currentColor?.name || 'Custom'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 ml-11">
                        {TEAM_COLORS.map((color) => {
                          const isSelected = team.color === color.hex
                          const isUsed = !isSelected && teams.some(t => t.id !== team.id && t.color === color.hex)
                          return (
                            <button
                              key={color.hex}
                              type="button"
                              title={isUsed ? `${color.name} (taken)` : color.name}
                              disabled={isUsed}
                              onClick={() => handleTeamColorChange(team.id, color.hex)}
                              className="relative w-7 h-7 rounded-full transition-all duration-150 flex-shrink-0"
                              style={{
                                backgroundColor: color.hex,
                                opacity: isUsed ? 0.25 : 1,
                                cursor: isUsed ? 'not-allowed' : 'pointer',
                                outline: isSelected ? '2px solid var(--color-text)' : '2px solid transparent',
                                outlineOffset: '2px',
                                transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                              }}
                            >
                              {isSelected && (
                                <svg className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Section 4: Draft Type */}
          <div className="bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="px-6 py-4 border-l-4 border-[var(--color-primary)]">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Draft Type</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" checked={draftType === 'snake'} onChange={() => setDraftType('snake')} className="mt-1" />
                <div>
                  <div className="font-medium text-[var(--color-text)]">Snake Draft</div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Picks alternate direction each round (1-2-3...3-2-1)</div>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" checked={draftType === 'linear'} onChange={() => setDraftType('linear')} className="mt-1" />
                <div>
                  <div className="font-medium text-[var(--color-text)]">Linear Draft</div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Same pick order every round (1-2-3...1-2-3)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 5: Draft Order */}
          <div className="bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="px-6 py-4 border-l-4 border-[var(--color-primary)] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Draft Order</h2>
              <button
                onClick={handleRandomizeDraftOrder}
                disabled={isShuffling}
                title="Shuffle order"
                className="p-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
              >
                <svg className={`w-5 h-5 ${isShuffling ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">Drag teams to reorder, or click shuffle to randomize.</p>
              <div className="space-y-1">
                <AnimatePresence mode="popLayout">
                  {draftOrder.map((team, index) => {
                    const isDragging = draggedTeam === team.id
                    const isDragOver = dragOverIndex === index && draggedTeam !== null && draggedTeam !== team.id
                    return (
                      <motion.div
                        key={team.id}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{
                          opacity: isDragging ? 0.4 : 1,
                          scale: isDragging ? 0.95 : 1,
                          y: 0,
                        }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{
                          layout: { type: 'spring', stiffness: 500, damping: 35 },
                          opacity: { duration: 0.2 },
                          scale: { duration: 0.2 },
                        }}
                        draggable
                        onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent<HTMLDivElement>, team.id)}
                        onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent<HTMLDivElement>, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e as unknown as React.DragEvent<HTMLDivElement>, team.id)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-grab active:cursor-grabbing select-none transition-colors ${
                          isDragOver
                            ? 'bg-[var(--color-primary)]/15 border-2 border-dashed border-[var(--color-primary)] shadow-lg'
                            : 'bg-[var(--color-bg-secondary)] border-2 border-transparent hover:bg-[var(--color-border)]'
                        }`}
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                        <span className="font-medium text-[var(--color-text)] flex-1">{team.name}</span>
                        <svg className="w-5 h-5 text-[var(--color-text-secondary)] opacity-40" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
                        </svg>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Section 6: Player List */}
          <div className="bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="px-6 py-4 border-l-4 border-[var(--color-primary)]">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Player List</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Players (one per line)</label>
                <textarea
                  ref={textareaRef}
                  value={playerNames}
                  onChange={handlePlayerChange}
                  placeholder={"Player 1\nPlayer 2\nPlayer 3..."}
                  rows={6}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none font-mono text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text)]">{playerCount}</span> players entered
                </p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Need: <span className="font-semibold text-[var(--color-text)]">{totalPlayersNeeded}</span> ({numTeams} teams × {maxPlayersPerTeam} players)
                </p>
              </div>
            </div>
          </div>

          {/* Section 7: Positions & Rankings (Optional) */}
          <div className="bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div
              className="px-6 py-4 border-l-4 border-[var(--color-primary)] flex items-center justify-between cursor-pointer"
              onClick={() => setEnablePositions(!enablePositions)}
            >
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Positions & Rankings</h2>
              <span className="text-[var(--color-text-secondary)] text-xl">{enablePositions ? '−' : '+'}</span>
            </div>

            {enablePositions && (
              <div className="px-6 py-4 space-y-4 border-t border-[var(--color-border)]">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Sport Preset</label>
                  <select
                    value={sportPreset}
                    onChange={(e) => handleSportPresetChange(e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
                  >
                    {SPORT_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {sportPreset === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Add Custom Positions</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="customPositionInput"
                        placeholder="e.g., Wing, Guard"
                        className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('customPositionInput') as HTMLInputElement
                          if (input?.value) {
                            handleAddCustomPosition(input.value)
                            input.value = ''
                          }
                        }}
                        className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-lg font-medium transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {positions.map((position) => (
                        <div key={position} className="flex items-center gap-2 px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full text-sm">
                          {position}
                          <button onClick={() => handleRemovePosition(position)} className="hover:text-red-500">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {positions.length > 0 && playerList.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">Assign Positions</label>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border)]">
                            <th className="text-left px-3 py-2 font-semibold text-[var(--color-text)]">Player</th>
                            <th className="text-left px-3 py-2 font-semibold text-[var(--color-text)]">Primary</th>
                            <th className="text-left px-3 py-2 font-semibold text-[var(--color-text)]">Secondary</th>
                            <th className="text-left px-3 py-2 font-semibold text-[var(--color-text)]">Ranking</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playerList.map((player, index) => (
                            <tr key={index} className="border-b border-[var(--color-border)]/50">
                              <td className="px-3 py-2 text-[var(--color-text)]">{player.name}</td>
                              <td className="px-3 py-2">
                                <select
                                  value={player.primary_position || ''}
                                  onChange={(e) => handleUpdatePlayer(index, 'primary_position', e.target.value)}
                                  className="px-2 py-1 border border-[var(--color-border)] rounded bg-[var(--color-bg)] text-[var(--color-text)] text-sm"
                                >
                                  <option value="">—</option>
                                  {positions.map((pos) => (<option key={pos} value={pos}>{pos}</option>))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={player.secondary_position || ''}
                                  onChange={(e) => handleUpdatePlayer(index, 'secondary_position', e.target.value)}
                                  className="px-2 py-1 border border-[var(--color-border)] rounded bg-[var(--color-bg)] text-[var(--color-text)] text-sm"
                                >
                                  <option value="">—</option>
                                  {positions.map((pos) => (<option key={pos} value={pos}>{pos}</option>))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={player.ranking || ''}
                                  onChange={(e) => handleUpdatePlayer(index, 'ranking', parseInt(e.target.value) || 0)}
                                  className="w-16 px-2 py-1 border border-[var(--color-border)] rounded bg-[var(--color-bg)] text-[var(--color-text)] text-sm"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 8: Trade Time */}
          <div className="bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="px-6 py-4 border-l-4 border-[var(--color-primary)]">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Trade Time</h2>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Extra time added for initiated trade (seconds)</label>
              <input
                type="number"
                min="0"
                value={tradeTime}
                onChange={(e) => setTradeTime(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Section 9: Draft Mode */}
          <div className="bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="px-6 py-4 border-l-4 border-[var(--color-primary)]">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Draft Mode</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex gap-2 bg-[var(--color-bg-secondary)] p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDraftMode('single')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                    draftMode === 'single'
                      ? 'bg-[var(--color-primary)] text-white shadow-md'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  Single Person
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftMode('live')
                    if (!joinCode) setJoinCode(generateJoinCode())
                  }}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                    draftMode === 'live'
                      ? 'bg-[var(--color-primary)] text-white shadow-md'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  Live Multiplayer
                </button>
              </div>

              {draftMode === 'single' && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  You control all teams and make every pick yourself.
                </p>
              )}

              {draftMode === 'live' && (
                <div className="space-y-4">
                  <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-lg p-4">
                    <p className="text-sm font-medium text-[var(--color-text)] mb-2">Join Code</p>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-[var(--color-primary)] font-mono tracking-widest">{joinCode}</div>
                      <button
                        onClick={() => navigator.clipboard.writeText(joinCode)}
                        className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                      Share this code with others to join the draft. You'll need to approve each participant before they can pick.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Generate Board Button */}
          <div className="flex gap-4">
            <button
              onClick={handleGenerateBoard}
              disabled={saving || playerCount === 0}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] hover:shadow-lg text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {saving ? 'Generating Board...' : 'Generate Board'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function generateJoinCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export default function DraftSetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center"><div className="text-[var(--color-text-secondary)]">Loading...</div></div>}>
      <DraftSetupPageInner />
    </Suspense>
  )
}
