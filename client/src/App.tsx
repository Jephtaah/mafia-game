import { useState, useCallback, useEffect, useRef } from 'react'
import JoinScreen from './components/JoinScreen'
import LobbyScreen from './components/LobbyScreen'
import { useWebSocket } from './hooks/useWebSocket'
import type { ServerMessage, PlayerInfo } from './types/messages'

type AppState =
  | { screen: 'join'; error: string }
  | { screen: 'lobby'; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean; error: string }

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
        setState({ ...s, error: msg.message })
      } else if (msg.type === 'player_list') {
        if (s.screen === 'lobby') {
          setState({ ...s, players: msg.players })
        }
      }
    })
  }, [onMessage])

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: '' }))
  }, [])

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
