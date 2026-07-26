import { useState, useCallback, useEffect, useRef } from 'react'
import JoinScreen from './components/JoinScreen'
import LobbyScreen from './components/LobbyScreen'
import RoleReveal from './components/RoleReveal'
import NightScreen from './components/NightScreen'
import ResolutionScreen from './components/ResolutionScreen'
import ChatScreen from './components/ChatScreen'
import VotingScreen from './components/VotingScreen'
import GameOverScreen from './components/GameOverScreen'
import { useWebSocket } from './hooks/useWebSocket'
import type { ServerMessage, PlayerInfo } from './types/messages'

const STORAGE_TOKEN_KEY = 'mafia_token'
const STORAGE_CODE_KEY = 'mafia_code'

interface Toast {
  id: number
  message: string
  type: 'info' | 'warning'
  leaving: boolean
}

interface ChatMessage {
  playerId: string
  name: string
  text: string
}

type AppState =
  | { screen: 'join'; error: string }
  | { screen: 'reconnecting'; error: string }
  | { screen: 'lobby'; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; error: string }
  | { screen: 'role_reveal'; role: string; desc?: string; fellowImpostors?: PlayerInfo[]; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; timer: number }
  | { screen: 'night'; role: string; fellowImpostors?: PlayerInfo[]; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; isAlive: boolean; timer: number; votedCount: number; waiting: boolean }
  | { screen: 'resolution'; eliminated: string | null; eliminatedRole: string | null; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; role: string; fellowImpostors?: PlayerInfo[]; timer: number }
  | { screen: 'day'; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; role: string; fellowImpostors?: PlayerInfo[]; timer: number; isAlive: boolean; chatMessages: ChatMessage[] }
  | { screen: 'voting'; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; role: string; fellowImpostors?: PlayerInfo[]; timer: number; isAlive: boolean; votes: { playerId: string; target: string }[]; elimination: { eliminated: string | null; role: string | null } | null }
  | { screen: 'game_over'; winner: string; players: { id: string; name: string; role: string; isAlive: boolean }[]; playerId: string }

function getInitialState(): AppState {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY)
  if (token) {
    return { screen: 'reconnecting', error: '' }
  }
  return { screen: 'join', error: '' }
}

let toastIdCounter = 0

let audioCtx: AudioContext | null = null
function playPhaseSound(phase: string) {
  try {
    if (!audioCtx) {
      const AC: typeof AudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!
      audioCtx = new AC()
    }
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    gain.gain.value = 0.08
    const now = audioCtx.currentTime
    switch (phase) {
      case 'night':
        osc.frequency.setValueAtTime(220, now)
        osc.frequency.linearRampToValueAtTime(180, now + 0.4)
        osc.start(now)
        osc.stop(now + 0.4)
        break
      case 'day':
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.linearRampToValueAtTime(520, now + 0.25)
        osc.start(now)
        osc.stop(now + 0.25)
        break
      case 'voting':
        osc.frequency.setValueAtTime(330, now)
        osc.type = 'square'
        osc.start(now)
        osc.stop(now + 0.15)
        break
      case 'resolution':
        osc.frequency.setValueAtTime(260, now)
        osc.frequency.linearRampToValueAtTime(220, now + 0.5)
        gain.gain.linearRampToValueAtTime(0, now + 0.5)
        osc.start(now)
        osc.stop(now + 0.5)
        break
    }
  } catch {
    // Audio not supported
  }
}

function App() {
  const [state, setState] = useState<AppState>(getInitialState)
  const [toasts, setToasts] = useState<Toast[]>([])
  const { send, onMessage, onClose, readyState, connect, clearCallbacks } = useWebSocket()
  const stateRef = useRef(state)
  const reconnectStarted = useRef(false)
  const retryCount = useRef(0)

  const addToast = useCallback((message: string, type: 'info' | 'warning') => {
    const id = ++toastIdCounter
    setToasts((prev) => [...prev, { id, message, type, leaving: false }])
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t))
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 300)
    }, 3000)
  }, [])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN_KEY)
    if (token && !reconnectStarted.current) {
      reconnectStarted.current = true
      connect('ws://localhost:3001/ws')
    }
  }, [connect])

  useEffect(() => {
    onClose(() => {
      const s = stateRef.current
      if (s.screen === 'join' || s.screen === 'game_over' || s.screen === 'reconnecting') {
        retryCount.current = 0
        return
      }
      const token = localStorage.getItem(STORAGE_TOKEN_KEY)
      if (!token) return
      const attempt = retryCount.current + 1
      retryCount.current = attempt
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000)
      setState({ screen: 'reconnecting', error: '' })
      addToast(`Connection lost. Retrying in ${Math.round(delay / 1000)}s...`, 'warning')
      setTimeout(() => {
        connect('ws://localhost:3001/ws')
      }, delay)
    })
  }, [onClose, connect, addToast])

  useEffect(() => {
    if (readyState === WebSocket.OPEN && state.screen === 'reconnecting') {
      const token = localStorage.getItem(STORAGE_TOKEN_KEY)
      if (token) {
        retryCount.current = 0
        send({ type: 'reconnect', token })
      }
    }
  }, [readyState, state.screen, send])

  const myAlive = useCallback((ps: PlayerInfo[], pid: string) => {
    return ps.find((p) => p.id === pid)?.isAlive ?? true
  }, [])

  const updatePlayerConnected = useCallback((players: PlayerInfo[], playerId: string, connected: boolean): PlayerInfo[] => {
    return players.map((p) => p.id === playerId ? { ...p, connected } : p)
  }, [])

  useEffect(() => {
    onMessage((msg: ServerMessage) => {
      const s = stateRef.current
      if (msg.type === 'room_created') {
        localStorage.setItem(STORAGE_TOKEN_KEY, msg.token)
        localStorage.setItem(STORAGE_CODE_KEY, msg.code)
        setState({
          screen: 'lobby',
          code: msg.code,
          playerId: msg.playerId,
          token: msg.token,
          players: msg.players,
          isHost: msg.isHost,
          error: '',
        })
      } else if (msg.type === 'resume_state') {
        const token = localStorage.getItem(STORAGE_TOKEN_KEY) || ''
        const code = localStorage.getItem(STORAGE_CODE_KEY) || ''
        const myId = msg.playerId

        if (msg.phase === 'night') {
          setState({
            screen: 'night',
            role: msg.role || 'crewmate',
            fellowImpostors: msg.fellowImpostors,
            code,
            playerId: myId,
            token,
            players: msg.players,
            isHost: false,
            isAlive: msg.isAlive,
            timer: msg.timer,
            votedCount: msg.voted?.length ?? 0,
            waiting: msg.waiting ?? (msg.fellowImpostors?.length ?? 0) > 0,
          })
        } else if (msg.phase === 'resolution') {
          setState({
            screen: 'resolution',
            eliminated: msg.eliminated ?? null,
            eliminatedRole: msg.eliminatedRole ?? null,
            code,
            playerId: myId,
            token,
            players: msg.players,
            isHost: false,
            role: msg.role || 'crewmate',
            fellowImpostors: msg.fellowImpostors,
            timer: msg.timer,
          })
        } else if (msg.phase === 'day') {
          setState({
            screen: 'day',
            code,
            playerId: myId,
            token,
            players: msg.players,
            isHost: false,
            role: msg.role || 'crewmate',
            fellowImpostors: msg.fellowImpostors,
            timer: msg.timer,
            isAlive: msg.isAlive,
            chatMessages: [],
          })
        } else if (msg.phase === 'voting') {
          setState({
            screen: 'voting',
            code,
            playerId: myId,
            token,
            players: msg.players,
            isHost: false,
            role: msg.role || 'crewmate',
            fellowImpostors: msg.fellowImpostors,
            timer: msg.timer,
            isAlive: msg.isAlive,
            votes: msg.votes ?? [],
            elimination: null,
          })
        } else if (msg.phase === 'lobby') {
          setState({
            screen: 'lobby',
            code,
            playerId: myId,
            token,
            players: msg.players,
            isHost: false,
            error: '',
          })
        } else if (msg.phase === 'ended') {
          setState({
            screen: 'join',
            error: '',
          })
        }
      } else if (msg.type === 'error') {
        if (s.screen === 'reconnecting') {
          localStorage.removeItem(STORAGE_TOKEN_KEY)
          localStorage.removeItem(STORAGE_CODE_KEY)
          setState({ screen: 'join', error: msg.message })
          clearCallbacks()
          return
        }
        setState((prev) => ({ ...prev, error: msg.message } as AppState))
      } else if (msg.type === 'player_list') {
        setState((prev) => {
          if (prev.screen === 'lobby' || prev.screen === 'role_reveal' || prev.screen === 'night' || prev.screen === 'resolution' || prev.screen === 'day' || prev.screen === 'voting') {
            return { ...prev, players: msg.players }
          }
          return prev
        })
      } else if (msg.type === 'player_disconnected') {
        const name = s.screen !== 'join' && s.screen !== 'reconnecting' && 'players' in s
          ? s.players.find((p) => p.id === msg.playerId)?.name
          : null
        if (name) addToast(`${name} disconnected`, 'warning')
        setState((prev) => {
          if ('players' in prev && prev.screen !== 'game_over') {
            return { ...prev, players: updatePlayerConnected(prev.players, msg.playerId, false) }
          }
          return prev
        })
      } else if (msg.type === 'player_reconnected') {
        const name = s.screen !== 'join' && s.screen !== 'reconnecting' && 'players' in s
          ? s.players.find((p) => p.id === msg.playerId)?.name
          : null
        if (name) addToast(`${name} reconnected`, 'info')
        setState((prev) => {
          if ('players' in prev && prev.screen !== 'game_over') {
            return { ...prev, players: updatePlayerConnected(prev.players, msg.playerId, true) }
          }
          return prev
        })
      } else if (msg.type === 'role_reveal') {
        if (s.screen === 'lobby') {
          setState({
            screen: 'role_reveal',
            role: msg.role,
            desc: msg.desc,
            fellowImpostors: msg.fellowImpostors,
            code: s.code,
            playerId: s.playerId,
            token: s.token,
            players: msg.players || s.players,
            isHost: s.isHost,
            timer: msg.timer,
          })
        }
      } else if (msg.type === 'resolution') {
        setState((prev) => {
          if (prev.screen === 'night' || prev.screen === 'role_reveal' || prev.screen === 'resolution') {
            const role = prev.screen === 'role_reveal' ? prev.role : 'role' in prev ? prev.role : 'crewmate'
            const fellowImpostors = prev.screen === 'role_reveal' ? prev.fellowImpostors : 'fellowImpostors' in prev ? prev.fellowImpostors : undefined
            const prevElim = 'eliminated' in prev ? prev.eliminated : null
            const prevElimRole = 'eliminatedRole' in prev ? prev.eliminatedRole : null
            return {
              screen: 'resolution',
              eliminated: msg.eliminated !== undefined ? msg.eliminated : prevElim,
              eliminatedRole: msg.role !== undefined ? msg.role : prevElimRole,
              code: prev.code,
              playerId: prev.playerId,
              token: prev.token,
              players: prev.players,
              isHost: prev.isHost,
              role,
              fellowImpostors,
              timer: 5,
            }
          }
          return prev
        })
      } else if (msg.type === 'night_status') {
        setState((prev) => {
          if (prev.screen === 'night') {
            return {
              ...prev,
              votedCount: msg.voted?.length ?? 0,
              waiting: msg.waiting ?? true,
            }
          }
          return prev
        })
      } else if (msg.type === 'chat_message') {
        setState((prev) => {
          if (prev.screen === 'day') {
            return {
              ...prev,
              chatMessages: [...prev.chatMessages, { playerId: msg.playerId, name: msg.name, text: msg.text }],
            }
          }
          return prev
        })
      } else if (msg.type === 'vote_tally') {
        setState((prev) => {
          if (prev.screen === 'voting') {
            return { ...prev, votes: msg.votes }
          }
          return prev
        })
      } else if (msg.type === 'investigation_result') {
        const targetName = s.screen !== 'join' && s.screen !== 'reconnecting' && 'players' in s
          ? s.players.find((p) => p.id === msg.target)?.name
          : null
        if (targetName) {
          addToast(msg.isImpostor ? `${targetName} is an impostor!` : `${targetName} is not an impostor.`, msg.isImpostor ? 'warning' : 'info')
        }
      } else if (msg.type === 'elimination') {
        setState((prev) => {
          if (prev.screen === 'voting') {
            return { ...prev, elimination: { eliminated: msg.eliminated, role: msg.role } }
          }
          return prev
        })
      } else if (msg.type === 'game_over') {
        localStorage.removeItem(STORAGE_TOKEN_KEY)
        localStorage.removeItem(STORAGE_CODE_KEY)
        const pid = 'playerId' in s ? s.playerId : ''
        if (s.screen !== 'join' && s.screen !== 'reconnecting') {
          setState({
            screen: 'game_over',
            winner: msg.winner,
            players: msg.players,
            playerId: pid,
          })
        }
      } else if (msg.type === 'phase_change') {
        playPhaseSound(msg.phase)
        setState((prev) => {
          if (prev.screen === 'role_reveal' || prev.screen === 'lobby') {
            if (msg.phase === 'night') {
              const role = prev.screen === 'role_reveal' ? prev.role : 'crewmate'
              const fellowImpostors = prev.screen === 'role_reveal' ? prev.fellowImpostors : undefined
              return {
                screen: 'night',
                role,
                fellowImpostors,
                code: prev.code,
                playerId: prev.playerId,
                token: prev.token,
                players: prev.players,
                isHost: prev.isHost,
                isAlive: true,
                timer: msg.timer,
                votedCount: 0,
                waiting: (fellowImpostors?.length ?? 0) > 0,
              }
            } else if (msg.phase === 'resolution') {
              const role = prev.screen === 'role_reveal' ? prev.role : 'crewmate'
              const fellowImpostors = prev.screen === 'role_reveal' ? prev.fellowImpostors : undefined
              const prevElim = 'eliminated' in prev ? prev.eliminated : null
              const prevElimRole = 'eliminatedRole' in prev ? prev.eliminatedRole : null
              return {
                screen: 'resolution',
                eliminated: prevElim,
                eliminatedRole: prevElimRole,
                code: prev.code,
                playerId: prev.playerId,
                token: prev.token,
                players: prev.players,
                isHost: prev.isHost,
                role,
                fellowImpostors,
                timer: msg.timer,
              }
            }
          } else if (prev.screen === 'night') {
            if (msg.phase === 'resolution') {
              const prevElim = 'eliminated' in prev ? prev.eliminated : null
              const prevElimRole = 'eliminatedRole' in prev ? prev.eliminatedRole : null
              return {
                screen: 'resolution',
                eliminated: prevElim,
                eliminatedRole: prevElimRole,
                code: prev.code,
                playerId: prev.playerId,
                token: prev.token,
                players: prev.players,
                isHost: prev.isHost,
                role: prev.role,
                fellowImpostors: prev.fellowImpostors,
                timer: msg.timer,
              }
            }
            return { ...prev, timer: msg.timer }
          } else if (prev.screen === 'resolution') {
            if (msg.phase === 'day') {
              return {
                screen: 'day',
                code: prev.code,
                playerId: prev.playerId,
                token: prev.token,
                players: prev.players,
                isHost: prev.isHost,
                role: prev.role,
                fellowImpostors: prev.fellowImpostors,
                timer: msg.timer,
                isAlive: myAlive(prev.players, prev.playerId),
                chatMessages: [],
              }
            } else {
              return { ...prev, timer: msg.timer }
            }
          } else if (prev.screen === 'day') {
            if (msg.phase === 'voting') {
              return {
                screen: 'voting',
                code: prev.code,
                playerId: prev.playerId,
                token: prev.token,
                players: prev.players,
                isHost: prev.isHost,
                role: prev.role,
                fellowImpostors: prev.fellowImpostors,
                timer: msg.timer,
                isAlive: myAlive(prev.players, prev.playerId),
                votes: [],
                elimination: null,
              }
            }
            if (msg.phase === 'night') {
              return {
                screen: 'night',
                role: prev.role,
                fellowImpostors: prev.fellowImpostors,
                code: prev.code,
                playerId: prev.playerId,
                token: prev.token,
                players: prev.players,
                isHost: prev.isHost,
                isAlive: myAlive(prev.players, prev.playerId),
                timer: msg.timer,
                votedCount: 0,
                waiting: (prev.fellowImpostors?.length ?? 0) > 0,
              }
            }
            return { ...prev, timer: msg.timer }
          } else if (prev.screen === 'voting') {
            if (msg.phase === 'night') {
              return {
                screen: 'night',
                role: prev.role,
                fellowImpostors: prev.fellowImpostors,
                code: prev.code,
                playerId: prev.playerId,
                token: prev.token,
                players: prev.players,
                isHost: prev.isHost,
                isAlive: myAlive(prev.players, prev.playerId),
                timer: msg.timer,
                votedCount: 0,
                waiting: (prev.fellowImpostors?.length ?? 0) > 0,
              }
            }
            return { ...prev, timer: msg.timer }
          }
          return prev
        })
      }
    })
  }, [onMessage, myAlive, updatePlayerConnected, clearCallbacks, addToast])

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: '' } as AppState))
  }, [])

  let screen: React.ReactNode

  if (state.screen === 'reconnecting') {
    screen = (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center animate-fade-in-up">
          <div className="mb-6 flex justify-center">
            <div className="w-12 h-12 border-2 border-[#C4A861]/25 border-t-[#C4A861] rounded-full animate-spin" />
          </div>
          <h1 className="text-2xl font-['Playfair_Display_SC'] text-[#C4A861] tracking-[0.08em] mb-2">
            RECONNECTING
          </h1>
          <p className="text-xs text-[#6B7280] mb-6">
            Your connection was lost. Attempting to restore it.
          </p>
          {state.error && (
            <div className="mb-6 p-3 border border-[#DC2626]/30 bg-[#DC2626]/5 text-[#DC2626] text-xs text-center">
              {state.error}
            </div>
          )}
          <button
            onClick={() => {
              localStorage.removeItem(STORAGE_TOKEN_KEY)
              localStorage.removeItem(STORAGE_CODE_KEY)
              setState({ screen: 'join', error: '' })
              clearCallbacks()
            }}
            className="border border-[#6B7280]/40 text-[#6B7280] text-xs tracking-[0.15em] uppercase
                       hover:bg-[#6B7280]/8 transition-all duration-300 px-5 py-2.5"
          >
            Return to Start
          </button>
        </div>
      </div>
    )
  } else if (state.screen === 'role_reveal') {
    screen = (
      <RoleReveal
        role={state.role}
        desc={state.desc}
        fellowImpostors={state.fellowImpostors}
        onDismiss={() => {
          setState({
            screen: 'night',
            role: state.role,
            fellowImpostors: state.fellowImpostors,
            code: state.code,
            playerId: state.playerId,
            token: state.token,
            players: state.players,
            isHost: state.isHost,
            isAlive: true,
            timer: state.timer,
            votedCount: 0,
            waiting: (state.fellowImpostors?.length ?? 0) > 0,
          })
        }}
      />
    )
  } else if (state.screen === 'resolution') {
    screen = (
      <ResolutionScreen
        eliminated={state.eliminated}
        role={state.eliminatedRole}
        players={state.players}
        timer={state.timer}
      />
    )
  } else if (state.screen === 'day') {
    screen = (
      <ChatScreen
        messages={state.chatMessages}
        isAlive={state.isAlive}
        onSend={(text) => send({ type: 'chat', text })}
        timer={state.timer}
      />
    )
  } else if (state.screen === 'night') {
    screen = (
      <NightScreen
        role={state.role}
        players={state.players}
        playerId={state.playerId}
        isAlive={state.isAlive}
        fellowImpostors={state.fellowImpostors}
        send={send}
        timer={state.timer}
        votedCount={state.votedCount}
        waiting={state.waiting}
      />
    )
  } else if (state.screen === 'voting') {
    screen = (
      <VotingScreen
        players={state.players}
        playerId={state.playerId}
        isAlive={state.isAlive}
        send={send}
        timer={state.timer}
        votes={state.votes}
        elimination={state.elimination}
      />
    )
  } else if (state.screen === 'game_over') {
    screen = (
      <GameOverScreen
        winner={state.winner}
        players={state.players}
        playerId={state.playerId}
      />
    )
  } else if (state.screen === 'lobby') {
    screen = (
      <LobbyScreen
        send={send}
        roomCode={state.code}
        isHost={state.isHost}
        players={state.players}
        error={state.error}
        onClearError={clearError}
      />
    )
  } else {
    screen = (
      <JoinScreen
        send={send}
        readyState={readyState}
        connect={connect}
        error={state.error}
        onClearError={clearError}
      />
    )
  }

  return (
    <div className="relative min-h-screen bg-[#0A0A0B] text-[#E8E8E8] blinds-overlay">
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 border text-sm ${
              t.type === 'warning'
                ? 'border-[#DC2626]/30 bg-[#DC2626]/10 text-[#DC2626]'
                : 'border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E]'
            } ${t.leaving ? 'animate-toast-out' : 'animate-toast-in'}`}
          >
            {t.message}
          </div>
        ))}
      </div>
      <div className="animate-phase-enter" key={state.screen}>
        {screen}
      </div>
    </div>
  )
}

export default App
