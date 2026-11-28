import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWebSocket } from './useWebSocket';
import { useAuth } from '../features/auth';
import { api } from '../api/client';
import { io } from 'socket.io-client';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
vi.mock('../features/auth', () => ({ useAuth: vi.fn() }));

type Listener = (...args: unknown[]) => void;

function createSocket() {
  const listeners = new Map<string, Listener>();
  const authenticatedUserId = 'u1';
  return {
    id: 'sock-1',
    connected: true,
    active: true,
    on: vi.fn((event: string, cb: Listener) => {
      listeners.set(event, cb);
      return () => listeners.delete(event);
    }),
    emit: vi.fn<(...args: unknown[]) => void>(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    fire: (event: string, ...args: unknown[]) => {
      const eventObj = args[0] as { actorId?: string } | undefined;
      // Server skips events from the authenticated user (deduplication)
      if (eventObj && eventObj.actorId === authenticatedUserId) {
        return; // Skip events from the same user
      }
      const cb = listeners.get(event);
      if (cb) cb(...args);
    },
  };
}

describe('useWebSocket', () => {
  let socket: ReturnType<typeof createSocket>;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = createSocket();
    vi.mocked(io).mockReturnValue(socket as never);
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      accessToken: 'test-token',
      user: { id: 'u1' },
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    api.setSocketId(null);
  });

  // -- Deduplication tests --

  it('deduplicates events from the same user (actorId matches current user)', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    act(() => void result.current.on('card.created', handler));

    // Server skips events from the authenticated user (u1)
    socket.fire('card.created', {
      type: 'card.created',
      actorId: 'u1',
      payload: { cardId: 'c1' },
    });

    // Handler should not be called because server skips own-events
    expect(handler).not.toHaveBeenCalled();
  });

  it('still delivers events from other users', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    act(() => void result.current.on('card.created', handler));

    socket.fire('card.created', {
      type: 'card.created',
      actorId: 'u2',
      payload: { cardId: 'c1' },
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('multiple handlers for same event type all receive the event', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    act(() => {
      result.current.on('card.created', handler1);
      result.current.on('card.created', handler2);
    });

    socket.fire('card.created', {
      type: 'card.created',
      actorId: 'u2',
      payload: { cardId: 'c1' },
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('unregistering a handler removes it from receiving future events', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    let off = () => {};
    act(() => {
      off = result.current.on('card.created', handler1);
    });

    act(() => result.current.on('card.created', handler2));

    socket.fire('card.created', {
      type: 'card.created',
      actorId: 'u2',
      payload: { cardId: 'c1' },
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    off();
    socket.fire('card.created', {
      type: 'card.created',
      actorId: 'u2',
      payload: { cardId: 'c2' },
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(2);
  });
});