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

interface ChatMessage {
  playerId: string
  name: string
  text: string
}

type AppState =
  | { screen: 'join'; error: string }
  | { screen: 'lobby'; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; error: string }
  | { screen: 'role_reveal'; role: string; fellowImpostors?: PlayerInfo[]; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; timer: number }
  | { screen: 'night'; role: string; fellowImpostors?: PlayerInfo[]; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; timer: number; votedCount: number; waiting: boolean }
  | { screen: 'resolution'; eliminated: string | null; eliminatedRole: string | null; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; role: string; fellowImpostors?: PlayerInfo[]; timer: number }
  | { screen: 'day'; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; role: string; fellowImpostors?: PlayerInfo[]; timer: number; isAlive: boolean; chatMessages: ChatMessage[] }
  | { screen: 'voting'; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; role: string; fellowImpostors?: PlayerInfo[]; timer: number; isAlive: boolean; votes: { playerId: string; target: string }[] }
  | { screen: 'game_over'; winner: string; players: { id: string; name: string; role: string; isAlive: boolean }[]; playerId: string }

function App() {
  const [state, setState] = useState<AppState>({ screen: 'join', error: '' })
  const { send, onMessage, readyState, connect } = useWebSocket()
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    onMessage((msg: ServerMessage) => {
      const s = stateRef.current
      if (msg.type === 'room_created') {
        setState({
          screen: 'lobby',
          code: msg.code,
          playerId: msg.playerId,
          token: msg.token,
          players: msg.players,
          isHost: msg.isHost,
          error: '',
        })
      } else if (msg.type === 'error') {
        setState({ ...s, error: msg.message } as AppState)
      } else if (msg.type === 'player_list') {
        if (s.screen === 'lobby' || s.screen === 'role_reveal' || s.screen === 'night' || s.screen === 'resolution') {
          setState({ ...s, players: msg.players })
        } else if (s.screen === 'day') {
          setState({ ...s, players: msg.players })
        } else if (s.screen === 'voting') {
          setState({ ...s, players: msg.players })
        }
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
      } else if (msg.type === 'game_over') {
        if (s.screen !== 'join') {
          setState({
            screen: 'game_over',
            winner: msg.winner,
            players: msg.players,
            playerId: s.playerId,
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
                isAlive: prev.eliminated !== prev.playerId,
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
                isAlive: prev.isAlive,
                votes: [],
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
  }, [onMessage])

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: '' } as AppState))
  }, [])

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
