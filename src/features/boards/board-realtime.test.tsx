import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import type { BoardDetail } from '../../api/schema';
import type { ConnectionStatus } from '../../hooks/useWebSocket';
import { renderWithProviders } from '../../test-utils';
import { BoardPage } from './BoardPage';
import { BoardHeader } from './BoardHeader';

const api = vi.hoisted(() => ({
  boards: { get: vi.fn() },
  cards: { move: vi.fn() },
  members: { list: vi.fn() },
}));
const ws = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown) => void>(),
  connect: undefined as undefined | (() => void),
  joinBoard: vi.fn(),
  status: 'connected' as string,
}));
const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('../../api/endpoints', () => ({
  boardsApi: api.boards,
  columnsApi: {},
  cardsApi: api.cards,
  membersApi: api.members,
}));
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    joinBoard: ws.joinBoard,
    leaveBoard: vi.fn(),
    on: (type: string, handler: (event: unknown) => void) => {
      ws.handlers.set(type, handler);
      return () => ws.handlers.delete(type);
    },
    onConnect: (handler: () => void) => {
      ws.connect = handler;
      return () => (ws.connect = undefined);
    },
    status: ws.status,
  }),
}));
vi.mock('../auth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));

const board = {
  id: 'b1',
  title: 'Sprint board',
  myRole: 'ADMIN',
  createdAt: '',
  updatedAt: '',
  columns: [{ id: 'c1', boardId: 'b1', title: 'To Do', type: 'TODO', position: 0, cards: [] }],
} as unknown as BoardDetail;

const routes = (
  <Routes>
    <Route path="/boards/:boardId" element={<BoardPage />} />
    <Route path="/boards" element={<p>Boards list</p>} />
  </Routes>
);

beforeEach(() => {
  ws.handlers.clear();
  ws.connect = undefined;
  ws.joinBoard.mockReset();
  ws.status = 'connected';
  toast.error.mockReset();
  api.boards.get.mockReset().mockResolvedValue(board);
  api.members.list.mockReset().mockResolvedValue([]);
});

describe('BoardPage realtime', () => {
  it('refetches only after the board:join ack is ok, also on reconnect', async () => {
    renderWithProviders(routes, '/boards/b1');
    await screen.findByText('Sprint board');
    api.boards.get.mockClear();

    act(() => ws.connect?.());
    expect(ws.joinBoard).toHaveBeenLastCalledWith('b1', expect.any(Function));
    expect(api.boards.get).not.toHaveBeenCalled();

    const ack = (ws.joinBoard.mock.lastCall as unknown[])[1] as (a: unknown) => void;
    act(() => ack({ ok: false, error: 'forbidden' }));
    expect(api.boards.get).not.toHaveBeenCalled();

    act(() => ack({ ok: true }));
    await waitFor(() => expect(api.boards.get).toHaveBeenCalledTimes(1));
  });

  it('refreshes the board on a card event', async () => {
    renderWithProviders(routes, '/boards/b1');
    await screen.findByText('Sprint board');
    api.boards.get.mockClear();
    act(() => ws.handlers.get('card.updated')?.({ payload: {} }));
    await waitFor(() => expect(api.boards.get).toHaveBeenCalledTimes(1));
  });

  it('skips the refresh while a move is in flight, and refetches when it settles', async () => {
    let finishMove: () => void = () => {};
    api.cards.move.mockReturnValue(new Promise<void>((resolve) => (finishMove = resolve)));
    const withCard = {
      ...board,
      columns: [
        {
          ...board.columns[0],
          cards: [{ id: 'k1', boardId: 'b1', columnId: 'c1', title: 'Card', position: 0 }],
        },
        { id: 'c2', boardId: 'b1', title: 'Done', type: 'DONE', position: 1, cards: [] },
      ],
    } as unknown as BoardDetail;
    api.boards.get.mockResolvedValue(withCard);
    renderWithProviders(routes, '/boards/b1');
    await screen.findByText('Card');

    const card = (await screen.findByText('Card')).closest('li') as HTMLElement;
    const done = screen.getByRole('region', { name: 'Column Done' });
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.dragOver(done);
    fireEvent.drop(done);
    await waitFor(() => expect(api.cards.move).toHaveBeenCalled());

    api.boards.get.mockClear();
    act(() => ws.handlers.get('card.moved')?.({ payload: {} }));
    expect(api.boards.get).not.toHaveBeenCalled();

    finishMove();
    await waitFor(() => expect(api.boards.get).toHaveBeenCalled());
  });

  it('leaves the board with a message when the current user is removed', async () => {
    renderWithProviders(routes, '/boards/b1');
    await screen.findByText('Sprint board');
    act(() => ws.handlers.get('member.removed')?.({ payload: { userId: 'me' } }));
    expect(await screen.findByText('Boards list')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('You were removed from this board');
  });

  it('refreshes the members when somebody else is removed', async () => {
    renderWithProviders(routes, '/boards/b1');
    await screen.findByText('Sprint board');
    api.members.list.mockClear();
    act(() => ws.handlers.get('member.removed')?.({ payload: { userId: 'other' } }));
    await waitFor(() => expect(api.members.list).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Boards list')).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('BoardHeader connection indicator', () => {
  it.each<[ConnectionStatus, string]>([
    ['connecting', 'Connecting...'],
    ['connected', 'Live'],
    ['offline', 'Offline, retrying...'],
  ])('announces %s as visible text in a status region', (status, text) => {
    renderWithProviders(<BoardHeader board={board} status={status} />);
    expect(screen.getByRole('status')).toHaveTextContent(text);
  });
});
