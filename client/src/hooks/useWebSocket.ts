import { useState, useRef, useCallback, useEffect } from 'react'
import type { ServerMessage } from '../types/messages'

interface UseWebSocketReturn {
  send: (msg: object) => void
  connect: (url: string) => void
  disconnect: () => void
  onMessage: (handler: (msg: ServerMessage) => void) => void
  onClose: (handler: () => void) => void
  readyState: number
  clearCallbacks: () => void
}

export function useWebSocket(): UseWebSocketReturn {
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED)
  const wsRef = useRef<WebSocket | null>(null)
  const handlerRef = useRef<((msg: ServerMessage) => void) | null>(null)
  const closeHandlerRef = useRef<(() => void) | null>(null)

  const connect = useCallback((url: string) => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setReadyState(WebSocket.OPEN)
    }

    ws.onmessage = (event) => {
      const data = event.data as string
      try {
        const msg = JSON.parse(data) as ServerMessage
        handlerRef.current?.(msg)
      } catch {
        // non-JSON
      }
    }

    ws.onclose = () => {
      setReadyState(WebSocket.CLOSED)
      wsRef.current = null
      closeHandlerRef.current?.()
    }

    ws.onerror = () => {
      ws.close()
    }

    setReadyState(WebSocket.CONNECTING)
  }, [])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
  }, [])

  const send = useCallback((msg: object) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const onMessage = useCallback((handler: (msg: ServerMessage) => void) => {
    handlerRef.current = handler
  }, [])

  const onClose = useCallback((handler: () => void) => {
    closeHandlerRef.current = handler
  }, [])

  const clearCallbacks = useCallback(() => {
    handlerRef.current = null
    closeHandlerRef.current = null
  }, [])

  return { send, connect, disconnect, onMessage, onClose, readyState, clearCallbacks }
}
