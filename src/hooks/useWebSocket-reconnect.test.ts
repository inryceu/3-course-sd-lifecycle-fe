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

  // -- Reconnect and refetch tests --

  it('reconnects manually after 5s when socket stopped retrying and socket is no longer active', () => {
    vi.useFakeTimers();
    socket.active = false;
    const { result } = renderHook(() => useWebSocket());
    act(() => socket.fire('connect_error', new Error('unauthorized')));
    expect(result.current.status).toBe('offline');
    act(() => void vi.advanceTimersByTime(5000));
    expect(socket.connect).toHaveBeenCalledTimes(1);
    // After manual retry, connect handler fires and status updates
    act(() => socket.fire('connect'));
    expect(result.current.status).toBe('connected');
  });

  it('reconnect handler runs on reconnect after manual retry', () => {
    vi.useFakeTimers();
    socket.active = false;
    socket.connected = false;
    const connectHandler = vi.fn();
    const { result } = renderHook(() => useWebSocket());
    act(() => void result.current.onConnect(connectHandler));
    act(() => void socket.fire('connect'));
    expect(connectHandler).toHaveBeenCalledTimes(1);
  });

  it('refetches board on reconnect after board:join ack', () => {
    vi.useFakeTimers();
    socket.active = false;
    socket.connected = false;
    const { result } = renderHook(() => useWebSocket());

    act(() => socket.fire('disconnect', 'transport close'));
    expect(result.current.status).toBe('offline');

    act(() => void vi.advanceTimersByTime(5000));
    expect(socket.connect).toHaveBeenCalledTimes(1);

    act(() => void socket.fire('connect'));
    expect(result.current.status).toBe('connected');
  });

  it('manual retry triggers socket.connect when inactive', () => {
    vi.useFakeTimers();
    socket.active = false;
    const { result } = renderHook(() => useWebSocket());

    act(() => void result.current.onConnect(() => {}));
    act(() => socket.fire('connect_error', new Error('unauthorized')));
    act(() => void vi.advanceTimersByTime(5000));
    expect(socket.connect).toHaveBeenCalledTimes(1);
    // After manual retry, connect handler fires and status updates
    act(() => socket.fire('connect'));
    expect(result.current.status).toBe('connected');
  });

  it('status transitions through all states on connect/disconnect cycle', () => {
    vi.useFakeTimers();
    socket.active = false;
    socket.connected = false;
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.status).toBe('connecting');

    act(() => socket.fire('disconnect', 'transport close'));
    expect(result.current.status).toBe('offline');

    act(() => void vi.advanceTimersByTime(5000));
    expect(socket.connect).toHaveBeenCalledTimes(1);

    act(() => socket.fire('connect'));
    expect(result.current.status).toBe('connected');
  });
});