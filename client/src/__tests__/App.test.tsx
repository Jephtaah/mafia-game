import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import App from '../App'
import type { ServerMessage, PlayerInfo } from '../types/messages'

type MessageHandler = (msg: ServerMessage) => void

const mockHandlers: { onMessage: MessageHandler | null } = { onMessage: null }

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    send: vi.fn(),
    onMessage: (handler: MessageHandler) => { mockHandlers.onMessage = handler },
    onClose: vi.fn(),
    readyState: WebSocket.CONNECTING,
    connect: vi.fn(),
    clearCallbacks: vi.fn(),
  }),
}))

function simulateMessage(msg: ServerMessage) {
  act(() => { mockHandlers.onMessage?.(msg) })
}

beforeEach(() => {
  mockHandlers.onMessage = null
  localStorage.clear()
})

describe('App phase transitions', () => {
  it('renders join screen initially', () => {
    const { container } = render(<App />)
    expect(container.textContent).toContain('MAFIA')
  })

  it('transitions to lobby on room_created', () => {
    render(<App />)
    simulateMessage({
      type: 'room_created',
      code: 'ABCD',
      playerId: 'p1',
      token: 'tok1',
      players: [{ id: 'p1', name: 'Alice', isHost: true, isAlive: true, connected: true }],
      isHost: true,
    })
    expect(screen.getByText('ABCD')).toBeDefined()
  })

  it('transitions to role_reveal then night on phase_change', () => {
    render(<App />)
    simulateMessage({
      type: 'room_created',
      code: 'ABCD',
      playerId: 'p1',
      token: 'tok1',
      players: [
        { id: 'p1', name: 'Alice', isHost: true, isAlive: true, connected: true },
        { id: 'p2', name: 'Bob', isHost: false, isAlive: true, connected: true },
      ],
      isHost: true,
    })

    simulateMessage({
      type: 'role_reveal',
      role: 'crewmate',
      timer: 30,
    })

    simulateMessage({
      type: 'phase_change',
      phase: 'night',
      timer: 30,
    })

    expect(screen.getByText('NIGHT FALLS')).toBeDefined()
  })

  it('shows error on error message', () => {
    render(<App />)
    simulateMessage({
      type: 'error',
      message: 'room not found',
    })
    expect(screen.getByText('room not found')).toBeDefined()
  })

  it('updates player list on player_list', () => {
    render(<App />)
    simulateMessage({
      type: 'room_created',
      code: 'ABCD',
      playerId: 'p1',
      token: 'tok1',
      players: [{ id: 'p1', name: 'Alice', isHost: true, isAlive: true, connected: true }],
      isHost: true,
    })

    const newPlayers: PlayerInfo[] = [
      { id: 'p1', name: 'Alice', isHost: true, isAlive: true, connected: true },
      { id: 'p2', name: 'Bob', isHost: false, isAlive: true, connected: true },
    ]
    simulateMessage({ type: 'player_list', players: newPlayers })
  })

  it('handles game_over transition', () => {
    render(<App />)
    simulateMessage({
      type: 'room_created',
      code: 'ABCD',
      playerId: 'p1',
      token: 'tok1',
      players: [{ id: 'p1', name: 'Alice', isHost: true, isAlive: true, connected: true }],
      isHost: true,
    })

    simulateMessage({
      type: 'game_over',
      winner: 'crewmates',
      players: [{ id: 'p1', name: 'Alice', role: 'crewmate', isAlive: true }],
    })

    expect(screen.getByText(/crewmates/i)).toBeDefined()
  })

  it('transitions through full day cycle', () => {
    render(<App />)
    simulateMessage({
      type: 'room_created',
      code: 'ABCD',
      playerId: 'p1',
      token: 'tok1',
      players: [
        { id: 'p1', name: 'Alice', isHost: true, isAlive: true, connected: true },
        { id: 'p2', name: 'Bob', isHost: false, isAlive: true, connected: true },
      ],
      isHost: true,
    })

    simulateMessage({ type: 'role_reveal', role: 'crewmate', timer: 30 })
    simulateMessage({ type: 'phase_change', phase: 'night', timer: 30 })
    simulateMessage({ type: 'phase_change', phase: 'resolution', timer: 5 })
    simulateMessage({ type: 'phase_change', phase: 'day', timer: 60 })

    expect(screen.getByText('Daybreak')).toBeDefined()
  })
})
