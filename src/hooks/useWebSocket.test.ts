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

  it('sends the board:join with an ack callback only while connected, and board:leave', () => {
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
    // Server skips events from the authenticated user (u1) - deduplication
    socket.fire('card.created', { type: 'card.created', actorId: 'u1', payload: {} });
    // Handler should not be called because server skips own-events
    expect(handler).not.toHaveBeenCalled();
  });

  // --- NEW: Event application tests ---

  it('applies card.created event through handler', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    act(() => void result.current.on('card.created', handler));

    socket.fire('card.created', {
      type: 'card.created',
      boardId: 'b1',
      actorId: 'u2',
      origin: 'user',
      occurredAt: '2026-01-01T00:00:00Z',
      payload: { cardId: 'c1', title: 'New Card', columnId: 'c1', position: 0 },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const lastCall = handler.mock.calls[0][0];
    expect(lastCall).toMatchObject({
      type: 'card.created',
      boardId: 'b1',
      payload: { cardId: 'c1', title: 'New Card', columnId: 'c1', position: 0 },
    });
  });

  it('applies card.updated event through handler', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    act(() => void result.current.on('card.updated', handler));

    socket.fire('card.updated', {
      type: 'card.updated',
      boardId: 'b1',
      actorId: 'u2',
      origin: 'user',
      occurredAt: '2026-01-01T00:00:00Z',
      payload: { cardId: 'c1', title: 'Updated Card', columnId: 'c1', position: 1, labels: [] },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const lastCall = handler.mock.calls[0][0];
    expect(lastCall).toMatchObject({
      type: 'card.updated',
      boardId: 'b1',
      payload: { cardId: 'c1', title: 'Updated Card', columnId: 'c1', position: 1, labels: [] },
    });
  });

  it('applies card.moved event through handler', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    act(() => void result.current.on('card.moved', handler));

    socket.fire('card.moved', {
      type: 'card.moved',
      boardId: 'b1',
      actorId: 'u2',
      origin: 'user',
      occurredAt: '2026-01-01T00:00:00Z',
      payload: { cardId: 'c1', fromColumnId: 'c1', toColumnId: 'c2', fromPosition: 0, toPosition: 1 },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const lastCall = handler.mock.calls[0][0];
    expect(lastCall).toMatchObject({
      type: 'card.moved',
      boardId: 'b1',
      payload: { cardId: 'c1', fromColumnId: 'c1', toColumnId: 'c2', fromPosition: 0, toPosition: 1 },
    });
  });

  it('applies card.commented event through handler', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    act(() => void result.current.on('card.commented', handler));

    socket.fire('card.commented', {
      type: 'card.commented',
      boardId: 'b1',
      actorId: 'u2',
      origin: 'user',
      occurredAt: '2026-01-01T00:00:00Z',
      payload: { cardId: 'c1', commentId: 'cm1', comment: 'Great card!' },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const lastCall = handler.mock.calls[0][0];
    expect(lastCall).toMatchObject({
      type: 'card.commented',
      boardId: 'b1',
      payload: { cardId: 'c1', commentId: 'cm1', comment: 'Great card!' },
    });
  });

  it('applies board.updated event through handler', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    act(() => void result.current.on('board.updated', handler));

    socket.fire('board.updated', {
      type: 'board.updated',
      boardId: 'b1',
      actorId: 'u2',
      origin: 'user',
      occurredAt: '2026-01-01T00:00:00Z',
      payload: { board: { id: 'b1', title: 'Updated Board', columns: [] } },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const lastCall = handler.mock.calls[0][0];
    expect(lastCall).toMatchObject({
      type: 'board.updated',
      boardId: 'b1',
      payload: { board: { id: 'b1', title: 'Updated Board', columns: [] } },
    });
  });

  it('applies member.removed event through handler', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    act(() => void result.current.on('member.removed', handler));

    socket.fire('member.removed', {
      type: 'member.removed',
      boardId: 'b1',
      actorId: 'u2',
      origin: 'user',
      occurredAt: '2026-01-01T00:00:00Z',
      payload: { userId: 'u2' },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const lastCall = handler.mock.calls[0][0];
    expect(lastCall).toMatchObject({
      type: 'member.removed',
      boardId: 'b1',
      payload: { userId: 'u2' },
    });
  });

  it('applies notification.created event through handler', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();
    act(() => void result.current.on('notification.created', handler));

    socket.fire('notification.created', {
      type: 'notification.created',
      boardId: 'b1',
      actorId: 'u2',
      origin: 'user',
      occurredAt: '2026-01-01T00:00:00Z',
      payload: { notificationId: 'n1', title: 'New notification', content: 'You have a new card!' },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const lastCall = handler.mock.calls[0][0];
    expect(lastCall).toMatchObject({
      type: 'notification.created',
      boardId: 'b1',
      payload: { notificationId: 'n1', title: 'New notification', content: 'You have a new card!' },
    });
  });

  // --- NEW: Deduplication tests ---

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

  // --- NEW: Reconnect and refetch tests ---

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