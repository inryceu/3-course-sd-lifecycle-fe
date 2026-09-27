import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../features/auth/AuthContext';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

type EventHandler = (data: any) => void;

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { isAuthenticated, accessToken } = useAuth();
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    socketRef.current = io(WS_URL, {
      path: '/realtime',
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    socketRef.current.on('board:update', (data) => {
      const handlers = handlersRef.current.get('board:update');
      if (handlers) {
        handlers.forEach((handler) => handler(data));
      }
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken]);

  const joinBoard = useCallback((boardId: string) => {
    socketRef.current?.emit('joinBoard', { boardId });
  }, []);

  const leaveBoard = useCallback((boardId: string) => {
    socketRef.current?.emit('leaveBoard', { boardId });
  }, []);

  const on = useCallback((event: string, handler: EventHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);

    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  return { joinBoard, leaveBoard, on };
}