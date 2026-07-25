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

interface ChatMessage {
  playerId: string
  name: string
  text: string
}

type AppState =
  | { screen: 'join'; error: string }
  | { screen: 'reconnecting'; error: string }
  | { screen: 'lobby'; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; error: string }
  | { screen: 'role_reveal'; role: string; fellowImpostors?: PlayerInfo[]; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; timer: number }
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

function App() {
  const [state, setState] = useState<AppState>(getInitialState)
  const { send, onMessage, onClose, readyState, connect, clearCallbacks } = useWebSocket()
  const stateRef = useRef(state)
  const reconnectStarted = useRef(false)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Attempt reconnect on mount if we have stored credentials
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN_KEY)
    if (token && !reconnectStarted.current) {
      reconnectStarted.current = true
      connect('ws://localhost:3001/ws')
    }
  }, [connect])

  // On WebSocket close, attempt reconnect with stored token
  useEffect(() => {
    onClose(() => {
      const s = stateRef.current
      if (s.screen === 'join' || s.screen === 'game_over' || s.screen === 'reconnecting') {
        return // don't reconnect from these screens
      }
      const token = localStorage.getItem(STORAGE_TOKEN_KEY)
      if (!token) return
      setState({ screen: 'reconnecting', error: '' })
      setTimeout(() => {
        connect('ws://localhost:3001/ws')
      }, 1000)
    })
  }, [onClose, connect])

  // Send reconnect message when WebSocket opens while reconnecting
  useEffect(() => {
    if (readyState === WebSocket.OPEN && state.screen === 'reconnecting') {
      const token = localStorage.getItem(STORAGE_TOKEN_KEY)
      if (token) {
        send({ type: 'reconnect', token })
      }
    }
  }, [readyState, state.screen, send])

  const myAlive = useCallback((ps: PlayerInfo[], pid: string) => {
    return ps.find((p) => p.id === pid)?.isAlive ?? true
  }, [])

  // Helper to update a player's connected status in the players array
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
        // Restore from reconnect
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
          // Reconnect failed — go back to join
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
        setState((prev) => {
          if ('players' in prev && prev.screen !== 'game_over') {
            return { ...prev, players: updatePlayerConnected(prev.players, msg.playerId, false) }
          }
          return prev
        })
      } else if (msg.type === 'player_reconnected') {
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
            fellowImpostors: msg.fellowImpostors,
            code: s.code,
            playerId: s.playerId,
            token: s.token,
            players: s.players,
            isHost: s.isHost,
            timer: msg.timer,
          })
        }
      } else if (msg.type === 'resolution') {
        setState((prev) => {
          if (prev.screen === 'night') {
            return {
              screen: 'resolution',
              eliminated: msg.eliminated,
              eliminatedRole: msg.role,
              code: prev.code,
              playerId: prev.playerId,
              token: prev.token,
              players: prev.players,
              isHost: prev.isHost,
              role: prev.role,
              fellowImpostors: prev.fellowImpostors,
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
            }
          } else if (prev.screen === 'night') {
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
  }, [onMessage, myAlive, updatePlayerConnected, clearCallbacks])

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: '' } as AppState))
  }, [])

  if (state.screen === 'reconnecting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="bg-gray-800 rounded-xl p-8 w-full max-w-sm shadow-xl text-center">
          <h1 className="text-2xl font-bold mb-4">Reconnecting...</h1>
          <p className="text-gray-400 mb-4">Your connection was lost. Attempting to reconnect.</p>
          {state.error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded mb-4 text-sm">
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
            className="bg-gray-600 hover:bg-gray-500 rounded py-2 px-4 font-medium"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

  if (state.screen === 'role_reveal') {
    return (
      <RoleReveal
        role={state.role}
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
  }

  if (state.screen === 'resolution') {
    return (
      <ResolutionScreen
        eliminated={state.eliminated}
        role={state.eliminatedRole}
        players={state.players}
        timer={state.timer}
      />
    )
  }

  if (state.screen === 'day') {
    return (
      <ChatScreen
        messages={state.chatMessages}
        isAlive={state.isAlive}
        onSend={(text) => send({ type: 'chat', text })}
        timer={state.timer}
      />
    )
  }

  if (state.screen === 'night') {
    return (
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
  }

  if (state.screen === 'voting') {
    return (
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
  }

  if (state.screen === 'game_over') {
    return (
      <GameOverScreen
        winner={state.winner}
        players={state.players}
        playerId={state.playerId}
      />
    )
  }

  if (state.screen === 'lobby') {
    return (
      <LobbyScreen
        send={send}
        roomCode={state.code}
        isHost={state.isHost}
        players={state.players}
        error={state.error}
        onClearError={clearError}
      />
    )
  }

  return (
    <JoinScreen
      send={send}
      readyState={readyState}
      connect={connect}
      error={state.error}
      onClearError={clearError}
    />
  )
}

export default App
