import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWebSocket } from './useWebSocket';
import { useAuth } from '../features/auth';
import { io } from 'socket.io-client';

vi.mock('socket.io-client', () => {
  const mSocket = {
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  return { io: vi.fn(() => mSocket) };
});

vi.mock('../features/auth', () => ({
  useAuth: vi.fn(),
}));

describe('useWebSocket', () => {
  let mockSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = { on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
    (io as any).mockReturnValue(mockSocket);
    (useAuth as any).mockReturnValue({
      isAuthenticated: true,
      accessToken: 'test-token',
      user: { id: 'u1' },
    });
  });

  it('connects to socket when authenticated', () => {
    renderHook(() => useWebSocket());
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        auth: { token: 'test-token' },
        reconnection: true,
      })
    );
  });

  it('does not connect when not authenticated', () => {
    (useAuth as any).mockReturnValue({ isAuthenticated: false, accessToken: null, user: null });
    vi.clearAllMocks();
    renderHook(() => useWebSocket());
    expect(io).not.toHaveBeenCalled();
  });

  it('disconnects on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket());
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('emits board:join and board:leave', () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      result.current.joinBoard('board-1');
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('board:join', { boardId: 'board-1' });

    act(() => {
      result.current.leaveBoard('board-1');
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('board:leave', { boardId: 'board-1' });
  });

  it('registers and unregisters event handlers', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();

    let off: () => void;
    act(() => {
      off = result.current.on('card.created', handler);
    });

    const onCall = mockSocket.on.mock.calls.find((call: any) => call[0] === 'card.created');
    expect(onCall).toBeDefined();

    const socketCallback = onCall[1];
    socketCallback({ type: 'card.created', origin: 'user', boardId: 'b1', payload: {} });

    expect(handler).toHaveBeenCalledTimes(1);

    act(() => {
      off();
    });

    socketCallback({ type: 'card.created', origin: 'user', boardId: 'b1', payload: {} });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores events triggered by the same user (idempotent)', () => {
    const { result } = renderHook(() => useWebSocket());
    const handler = vi.fn();

    act(() => {
      result.current.on('card.created', handler);
    });

    const onCall = mockSocket.on.mock.calls.find((call: any) => call[0] === 'card.created');
    const socketCallback = onCall[1];

    socketCallback({
      type: 'card.created',
      actorId: 'u1',
      origin: 'user',
      boardId: 'b1',
      payload: {},
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
