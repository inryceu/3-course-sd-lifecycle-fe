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
  return {
    id: 'sock-1',
    connected: true,
    active: true,
    on: vi.fn((event: string, cb: Listener) => void listeners.set(event, cb)),
    emit: vi.fn<(...args: unknown[]) => void>(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    fire: (event: string, ...args: unknown[]) => listeners.get(event)?.(...args),
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

  it('connects with backoff and without an attempts cap', () => {
    renderHook(() => useWebSocket());
    const options = vi.mocked(io).mock.calls[0][1] as Record<string, unknown>;
    expect(options).toMatchObject({
      auth: { token: 'test-token' },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    expect(options).not.toHaveProperty('reconnectionAttempts');
  });

  it('does not connect when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      accessToken: null,
      user: null,
    } as never);
    renderHook(() => useWebSocket());
    expect(io).not.toHaveBeenCalled();
  });

  it('disconnects on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket());
    unmount();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('goes connecting -> connected -> offline and runs connect handlers', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    act(() => void result.current.onConnect(handler));
    expect(result.current.status).toBe('connecting');

    act(() => socket.fire('connect'));
    expect(result.current.status).toBe('connected');
    expect(handler).toHaveBeenCalledTimes(1);

    act(() => socket.fire('disconnect', 'transport close'));
    expect(result.current.status).toBe('offline');
  });

  it('shows offline on connect_error and retries by hand once the client stopped retrying', () => {
    vi.useFakeTimers();
    socket.active = false;
    const { result } = renderHook(() => useWebSocket());
    act(() => socket.fire('connect_error', new Error('unauthorized')));
    expect(result.current.status).toBe('offline');
    expect(socket.connect).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(5000));
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it('leaves reconnection to socket.io-client while it is active', () => {
    vi.useFakeTimers();
    renderHook(() => useWebSocket());
    act(() => socket.fire('connect_error', new Error('xhr poll error')));
    act(() => void vi.advanceTimersByTime(10000));
    expect(socket.connect).not.toHaveBeenCalled();
  });

  it('sends the socket id on REST mutations while connected and clears it on disconnect', () => {
    renderHook(() => useWebSocket());
    act(() => socket.fire('connect'));
    const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(new Response('{}', { status: 200 }))
    );
    vi.stubGlobal('fetch', fetchMock);
    void api.post('/x', {});
    const sentHeaders = (n: number) => fetchMock.mock.calls[n][1].headers as Record<string, string>;
    expect(sentHeaders(0)['X-Socket-Id']).toBe('sock-1');

    act(() => socket.fire('disconnect', 'transport close'));
    void api.post('/x', {});
    expect(sentHeaders(1)).not.toHaveProperty('X-Socket-Id');
    vi.unstubAllGlobals();
  });

  it('emits board:join with an ack callback only while connected, and board:leave', () => {
    const { result } = renderHook(() => useWebSocket());
    const onAck = vi.fn();

    act(() => result.current.joinBoard('board-1', onAck));
    expect(socket.emit).toHaveBeenCalledWith(
      'board:join',
      { boardId: 'board-1' },
      expect.any(Function)
    );
    (socket.emit.mock.calls[0][2] as (ack: unknown) => void)({ ok: true });
    expect(onAck).toHaveBeenCalledWith({ ok: true });

    act(() => result.current.leaveBoard('board-1'));
    expect(socket.emit).toHaveBeenCalledWith('board:leave', { boardId: 'board-1' });

    socket.emit.mockClear();
    socket.connected = false;
    act(() => result.current.joinBoard('board-1'));
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('registers and unregisters event handlers, including member.removed', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    let off = () => {};
    act(() => {
      off = result.current.on('member.removed', handler);
    });

    socket.fire('member.removed', { type: 'member.removed', payload: { userId: 'u2' } });
    expect(handler).toHaveBeenCalledTimes(1);

    off();
    socket.fire('member.removed', { type: 'member.removed', payload: { userId: 'u2' } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('delivers events caused by the same user (the server skips the sending socket)', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    act(() => void result.current.on('card.created', handler));
    socket.fire('card.created', { type: 'card.created', actorId: 'u1', payload: {} });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
