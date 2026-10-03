import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { useAuth } from '../features/auth';

/** Event names of docs/api/ws-events.md; the Socket.IO event name equals the envelope `type`. */
export const BOARD_EVENT_TYPES = [
  'card.created',
  'card.updated',
  'card.moved',
  'card.commented',
  'board.updated',
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

type EventHandler = (event: RealtimeEvent) => void;

const WS_ORIGIN = (import.meta.env.VITE_WS_URL as string | undefined) || window.location.origin;

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { isAuthenticated, accessToken, user } = useAuth();
  const handlersRef = useRef<Map<BoardEventType, Set<EventHandler>>>(new Map());
  const userIdRef = useRef<string | undefined>(user?.id);
  userIdRef.current = user?.id;

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    const socket = io(`${WS_ORIGIN}/realtime`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    BOARD_EVENT_TYPES.forEach((type) => {
      socket.on(type, (event: RealtimeEvent) => {
        // The author already applied the change optimistically.
        if (event.actorId && event.actorId === userIdRef.current) return;
        handlersRef.current.get(type)?.forEach((handler) => handler(event));
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken]);

  const joinBoard = useCallback((boardId: string) => {
    socketRef.current?.emit('board:join', { boardId });
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

  return { joinBoard, leaveBoard, on };
}
