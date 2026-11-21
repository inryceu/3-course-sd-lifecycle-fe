import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { useAuth } from '../features/auth';
import { api } from '../api/client';

/** Event names of docs/api/ws-events.md; the Socket.IO event name equals the envelope `type`. */
export const BOARD_EVENT_TYPES = [
  'card.created',
  'card.updated',
  'card.moved',
  'card.commented',
  'board.updated',
  'member.removed',
  'notification.created',
] as const;

export type BoardEventType = (typeof BOARD_EVENT_TYPES)[number];

export interface RealtimeEvent<T = unknown> {
  type: BoardEventType;
  boardId: string;
  actorId?: string;
  origin: 'user' | 'jira';
  occurredAt: string;
  payload: T;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'offline';

/** Ack of `board:join`: `{ ok: false, error: 'forbidden' }` for a non-member. */
export type JoinAck = { ok: boolean; error?: string } | undefined;

/** Retry delay when socket.io-client has stopped reconnecting (rejected handshake, server-side close). */
const MANUAL_RETRY_MS = 5000;

type EventHandler = (event: RealtimeEvent) => void;

const WS_ORIGIN = (import.meta.env.VITE_WS_URL as string | undefined) || window.location.origin;

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { isAuthenticated, accessToken } = useAuth();
  const handlersRef = useRef<Map<BoardEventType, Set<EventHandler>>>(new Map());
  const connectHandlersRef = useRef<Set<() => void>>(new Set());
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    setStatus('connecting');
    const socket = io(`${WS_ORIGIN}/realtime`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    // Reconnection never gives up by itself; this covers the cases where socket.io-client stops
    // (handshake rejected by the server, server-initiated close).
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const retryLater = () => {
      if (socket.active || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        socket.connect();
      }, MANUAL_RETRY_MS);
    };

    socket.on('connect', () => {
      setStatus('connected');
      // Events caused by our own REST calls are not echoed back to this socket.
      api.setSocketId(socket.id ?? null);
      connectHandlersRef.current.forEach((handler) => handler());
    });

    socket.on('disconnect', () => {
      setStatus('offline');
      api.setSocketId(null);
      retryLater();
    });

    socket.on('connect_error', () => {
      setStatus('offline');
      retryLater();
    });

    BOARD_EVENT_TYPES.forEach((type) => {
      socket.on(type, (event: RealtimeEvent) => {
        handlersRef.current.get(type)?.forEach((handler) => handler(event));
      });
    });

    return () => {
      clearTimeout(retryTimer);
      api.setSocketId(null);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken]);

  /** No-op while disconnected: the `connect` handler joins again, with the same board. */
  const joinBoard = useCallback((boardId: string, onAck?: (ack: JoinAck) => void) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit('board:join', { boardId }, (ack: JoinAck) => onAck?.(ack));
  }, []);

  const leaveBoard = useCallback((boardId: string) => {
    socketRef.current?.emit('board:leave', { boardId });
  }, []);

  const on = useCallback((type: BoardEventType, handler: EventHandler) => {
    const handlers = handlersRef.current.get(type) ?? new Set<EventHandler>();
    handlers.add(handler);
    handlersRef.current.set(type, handlers);

    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  const onConnect = useCallback((handler: () => void) => {
    connectHandlersRef.current.add(handler);
    return () => {
      connectHandlersRef.current.delete(handler);
    };
  }, []);

  return { joinBoard, leaveBoard, on, onConnect, status, isConnected: status === 'connected' };
}
