import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BoardDetail, BoardRole, Member } from '../../api/schema';
import { renderWithProviders } from '../../test-utils';
import { BoardHeader } from './BoardHeader';
import { BoardPage } from './BoardPage';
import { ColumnView } from './ColumnView';

const api = vi.hoisted(() => ({
  boards: { get: vi.fn(), update: vi.fn(), delete: vi.fn() },
  columns: { create: vi.fn(), update: vi.fn(), reorder: vi.fn(), delete: vi.fn() },
  cards: { create: vi.fn(), move: vi.fn() },
  members: { list: vi.fn() },
}));

vi.mock('../../api/endpoints', () => ({
  boardsApi: api.boards,
  columnsApi: api.columns,
  cardsApi: api.cards,
  membersApi: api.members,
}));
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    joinBoard: vi.fn(),
    leaveBoard: vi.fn(),
    on: vi.fn(() => vi.fn()),
    onConnect: vi.fn(() => vi.fn()),
    status: 'connected',
  }),
}));
vi.mock('../auth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));

const base = { boardId: 'b1', labelIds: [], createdAt: '', updatedAt: '' };

function boardAs(myRole: BoardRole): BoardDetail {
  return {
    id: 'b1',
    title: 'Sprint board',
    description: 'About',
    myRole,
    createdAt: '',
    updatedAt: '',
    columns: [
      {
        id: 'c1',
        boardId: 'b1',
        title: 'To Do',
        type: 'TODO',
        position: 0,
        cards: [
          { ...base, id: 'k1', columnId: 'c1', title: 'First', position: 0 },
          { ...base, id: 'k2', columnId: 'c1', title: 'Second', position: 1 },
        ],
      },
      { id: 'c2', boardId: 'b1', title: 'Done', type: 'DONE', position: 1, cards: [] },
    ],
  } as BoardDetail;
}

const route = (
  <Routes>
    <Route path="/boards/:boardId" element={<BoardPage />} />
    <Route path="/boards" element={<p>Boards list</p>} />
  </Routes>
);

const dnd = { dataTransfer: { setData: vi.fn(), effectAllowed: '' } };

beforeEach(() => {
  Object.values(api).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
  api.members.list.mockResolvedValue([]);
});

describe('BoardHeader', () => {
  it('lets only an Admin edit or delete the board', () => {
    const { unmount } = renderWithProviders(<BoardHeader board={boardAs('MEMBER')} />);
    expect(screen.queryByRole('button', { name: 'Edit board' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete board' })).not.toBeInTheDocument();
    expect(screen.getByText('Your role: MEMBER')).toBeInTheDocument();
    unmount();
    renderWithProviders(<BoardHeader board={boardAs('ADMIN')} />);
    expect(screen.getByRole('button', { name: 'Edit board' })).toBeInTheDocument();
  });

  it('saves a trimmed title and turns a blank description into null', async () => {
    api.boards.update.mockResolvedValue({});
    renderWithProviders(<BoardHeader board={boardAs('ADMIN')} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit board' }));
    const title = screen.getByLabelText('Title');
    expect(title).toHaveValue('Sprint board');
    await userEvent.clear(title);
    await userEvent.type(title, '  Renamed  ');
    await userEvent.clear(screen.getByLabelText('Description'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.boards.update).toHaveBeenCalledWith('b1', { title: 'Renamed', description: null });
    expect(await screen.findByRole('button', { name: 'Edit board' })).toBeInTheDocument();
  });

  it('does not save an empty title', async () => {
    renderWithProviders(<BoardHeader board={boardAs('ADMIN')} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit board' }));
    await userEvent.clear(screen.getByLabelText('Title'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: 'Board settings' }));
    expect(api.boards.update).not.toHaveBeenCalled();
  });

  it('cancel discards the edit', async () => {
    renderWithProviders(<BoardHeader board={boardAs('ADMIN')} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit board' }));
    await userEvent.type(screen.getByLabelText('Title'), ' more');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.boards.update).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
  });

  it('deletes the board only after confirmation and then leaves for the list', async () => {
    api.boards.delete.mockResolvedValue(undefined);
    renderWithProviders(
      <Routes>
        <Route path="/" element={<BoardHeader board={boardAs('ADMIN')} />} />
        <Route path="/boards" element={<p>Boards list</p>} />
      </Routes>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete board' }));
    expect(api.boards.delete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete board' }));
    expect(api.boards.delete).toHaveBeenCalledWith('b1');
    expect(await screen.findByText('Boards list')).toBeInTheDocument();
  });
});

describe('ColumnView', () => {
  const members = [{ userId: 'u9', displayName: 'Ada' }] as Member[];
  const card = (over: object) => ({
    ...base,
    id: 'k1',
    columnId: 'col',
    title: 'Card',
    position: 0,
    ...over,
  });

  function renderColumn(props: Partial<Parameters<typeof ColumnView>[0]> = {}, cards = [card({})]) {
    const handlers = {
      onDragStart: vi.fn(),
      onDrop: vi.fn(),
      onOpenCard: vi.fn(),
      onChanged: vi.fn(),
    };
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ColumnView
          column={{ id: 'col', boardId: 'b1', title: 'Col', type: 'TODO', position: 1, cards }}
          index={1}
          columnCount={3}
          canEditStructure
          canEditCards
          draggingCardId={null}
          members={members}
          {...handlers}
          {...props}
        />
      </QueryClientProvider>
    );
    return handlers;
  }

  it('reorders by one slot', async () => {
    api.columns.reorder.mockResolvedValue([]);
    const h = renderColumn();
    await userEvent.click(screen.getByRole('button', { name: 'Move column Col left' }));
    expect(api.columns.reorder).toHaveBeenLastCalledWith('col', 0);
    await userEvent.click(screen.getByRole('button', { name: 'Move column Col right' }));
    expect(api.columns.reorder).toHaveBeenLastCalledWith('col', 2);
    await waitFor(() => expect(h.onChanged).toHaveBeenCalledTimes(2));
  });

  it('the first column cannot move left', () => {
    renderColumn({ index: 0 });
    expect(screen.getByRole('button', { name: 'Move column Col left' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move column Col right' })).toBeEnabled();
  });

  it('the last column cannot move right', () => {
    renderColumn({ index: 2 });
    expect(screen.getByRole('button', { name: 'Move column Col right' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move column Col left' })).toBeEnabled();
  });

  it('edits title and type, trimming the title, and reports the change', async () => {
    api.columns.update.mockResolvedValue({});
    const h = renderColumn();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const title = screen.getByLabelText('Column title');
    await userEvent.clear(title);
    await userEvent.type(title, '  Review ');
    await userEvent.selectOptions(screen.getByLabelText('Column type'), 'DONE');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.columns.update).toHaveBeenCalledWith('col', { title: 'Review', type: 'DONE' });
    await waitFor(() => expect(h.onChanged).toHaveBeenCalled());
    expect(screen.queryByLabelText('Column title')).not.toBeInTheDocument();
  });

  it('refuses a blank column title and cancel keeps the old one', async () => {
    renderColumn();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByLabelText('Column title'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: 'Edit column Col' }));
    expect(api.columns.update).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Col' })).toBeInTheDocument();
  });

  it('adds a trimmed card title and ignores a blank one', async () => {
    api.cards.create.mockResolvedValue({});
    renderColumn();
    const input = screen.getByLabelText('New card in Col');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await userEvent.type(input, '   ');
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(api.cards.create).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, ' Ship it ');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(api.cards.create).toHaveBeenCalledWith('col', { title: 'Ship it' });
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('without edit rights: no add form, no structure controls, cards do not drag', () => {
    renderColumn({ canEditCards: false, canEditStructure: false });
    expect(screen.queryByLabelText('New card in Col')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByText('Card').closest('li')).toHaveAttribute('draggable', 'false');
  });

  it('opens a card on click and shows assignee (or "member" when unknown) and Jira key', async () => {
    const h = renderColumn({}, [
      card({ id: 'a', title: 'Mine', assigneeId: 'u9', jiraIssueKey: 'KAN-7' }),
      card({ id: 'b', title: 'Stranger', assigneeId: 'gone' }),
    ]);
    expect(screen.getByText('@Ada')).toBeInTheDocument();
    expect(screen.getByText('@member')).toBeInTheDocument();
    expect(screen.getByText('KAN-7')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Mine'));
    expect(h.onOpenCard).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('reports drag start and end, and drops in front of a card or at the end of the column', () => {
    const h = renderColumn({}, [card({ id: 'a', title: 'A' }), card({ id: 'b', title: 'B' })]);
    const a = screen.getByText('A').closest('li') as HTMLElement;
    fireEvent.dragStart(a, dnd);
    expect(h.onDragStart).toHaveBeenLastCalledWith('a');
    fireEvent.dragEnd(a);
    expect(h.onDragStart).toHaveBeenLastCalledWith(null);

    fireEvent.drop(screen.getByText('B').closest('li') as HTMLElement);
    expect(h.onDrop).toHaveBeenCalledTimes(1);
    expect(h.onDrop).toHaveBeenLastCalledWith('col', 'b');

    fireEvent.drop(screen.getByRole('region', { name: 'Column Col' }));
    expect(h.onDrop).toHaveBeenCalledTimes(2);
    expect(h.onDrop).toHaveBeenLastCalledWith('col', null);
  });
});

describe('BoardPage move guards', () => {
  const dragTo = async (cardTitle: string, region: string) => {
    const li = (await screen.findByText(cardTitle)).closest('li') as HTMLElement;
    fireEvent.dragStart(li, dnd);
    fireEvent.drop(screen.getByRole('region', { name: region }));
  };

  it('does not move anything for a Viewer', async () => {
    api.boards.get.mockResolvedValue(boardAs('VIEWER'));
    renderWithProviders(route, '/boards/b1');
    await dragTo('First', 'Column Done');
    await new Promise((r) => setTimeout(r, 50));
    expect(api.cards.move).not.toHaveBeenCalled();
  });

  it('ignores a drop that leaves the card where it is', async () => {
    api.boards.get.mockResolvedValue(boardAs('MEMBER'));
    renderWithProviders(route, '/boards/b1');
    // Second is already last in To Do; dropping it on the column end changes nothing.
    await dragTo('Second', 'Column To Do');
    await new Promise((r) => setTimeout(r, 50));
    expect(api.cards.move).not.toHaveBeenCalled();
  });

  it('a card dropped on itself stays where it is', async () => {
    api.boards.get.mockResolvedValue(boardAs('MEMBER'));
    renderWithProviders(route, '/boards/b1');
    const li = (await screen.findByText('First')).closest('li') as HTMLElement;
    fireEvent.dragStart(li, dnd);
    fireEvent.drop(li);
    await new Promise((r) => setTimeout(r, 50));
    expect(api.cards.move).not.toHaveBeenCalled();
  });

  it('moves to the end of the same column when dropped on the column', async () => {
    api.boards.get.mockResolvedValue(boardAs('MEMBER'));
    api.cards.move.mockResolvedValue({});
    renderWithProviders(route, '/boards/b1');
    await dragTo('First', 'Column To Do');
    await waitFor(() =>
      expect(api.cards.move).toHaveBeenCalledWith('k1', { columnId: 'c1', position: 1 })
    );
  });

  it('shows a not-found message when the board cannot be loaded', async () => {
    api.boards.get.mockRejectedValue(new Error('404'));
    renderWithProviders(route, '/boards/b1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Board not found.');
  });

  it('toggles the members panel and shows the member count', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    api.members.list.mockResolvedValue([
      {
        boardId: 'b1',
        userId: 'me',
        email: 'a@b.c',
        displayName: 'Me',
        role: 'ADMIN',
        invitedAt: '',
      },
    ]);
    renderWithProviders(route, '/boards/b1');
    const toggle = await screen.findByRole('button', { name: /Members \(1\)/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not add a blank column', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    renderWithProviders(route, '/boards/b1');
    const input = await screen.findByLabelText('New column title');
    expect(screen.getByRole('button', { name: 'Add column' })).toBeDisabled();
    await userEvent.type(input, '  ');
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(api.columns.create).not.toHaveBeenCalled();
  });
});
