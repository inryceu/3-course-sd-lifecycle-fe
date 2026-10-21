import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import type { BoardDetail, BoardRole } from '../../api/schema';
import { ApiError } from '../../api/client';
import { renderWithProviders } from '../../test-utils';
import { BoardsPage } from './BoardsPage';
import { BoardPage } from './BoardPage';

const api = vi.hoisted(() => ({
  boards: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  columns: { create: vi.fn(), update: vi.fn(), reorder: vi.fn(), delete: vi.fn() },
  cards: { create: vi.fn(), update: vi.fn(), move: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../api/endpoints', () => ({
  boardsApi: api.boards,
  columnsApi: api.columns,
  cardsApi: api.cards,
}));
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({ joinBoard: vi.fn(), leaveBoard: vi.fn(), on: () => () => undefined }),
}));

function boardAs(myRole: BoardRole): BoardDetail {
  const base = { boardId: 'b1', labelIds: [], createdAt: '', updatedAt: '' };
  return {
    id: 'b1',
    title: 'Sprint board',
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
        cards: [{ ...base, id: 'k1', columnId: 'c1', title: 'Write tests', position: 0 }],
      },
      {
        id: 'c2',
        boardId: 'b1',
        title: 'In Progress',
        type: 'IN_PROGRESS',
        position: 1,
        cards: [],
      },
      { id: 'c3', boardId: 'b1', title: 'Done', type: 'DONE', position: 2, cards: [] },
    ],
  };
}

const boardRoute = (
  <Routes>
    <Route path="/boards/:boardId" element={<BoardPage />} />
    <Route path="/boards" element={<p>Boards list</p>} />
  </Routes>
);

beforeEach(() => {
  Object.values(api).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
});

describe('BoardsPage', () => {
  it('creates a board and opens it', async () => {
    api.boards.list.mockResolvedValue([]);
    api.boards.create.mockResolvedValue(boardAs('ADMIN'));
    renderWithProviders(
      <Routes>
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/boards/:boardId" element={<p>Board opened</p>} />
      </Routes>,
      '/boards'
    );

    await userEvent.type(await screen.findByLabelText('New board title'), 'Sprint board');
    await userEvent.click(screen.getByRole('button', { name: 'Create board' }));

    await waitFor(() => expect(screen.getByText('Board opened')).toBeInTheDocument());
    expect(api.boards.create).toHaveBeenCalledWith({ title: 'Sprint board' });
  });
});

describe('BoardPage roles', () => {
  it('gives the Admin board, column and card controls', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    renderWithProviders(boardRoute, '/boards/b1');

    expect(await screen.findByRole('button', { name: 'Edit board' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add column' })).toBeInTheDocument();
    expect(screen.getByLabelText('New card in To Do')).toBeInTheDocument();
  });

  it('lets a Member edit cards but not the structure', async () => {
    api.boards.get.mockResolvedValue(boardAs('MEMBER'));
    renderWithProviders(boardRoute, '/boards/b1');

    expect(await screen.findByLabelText('New card in To Do')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit board' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add column' })).not.toBeInTheDocument();
  });

  it('shows a Viewer the board read-only', async () => {
    api.boards.get.mockResolvedValue(boardAs('VIEWER'));
    renderWithProviders(boardRoute, '/boards/b1');

    expect(await screen.findByText('Write tests')).toBeInTheDocument();
    expect(screen.queryByLabelText('New card in To Do')).not.toBeInTheDocument();
    expect(screen.getByText('Write tests').closest('li')).toHaveAttribute('draggable', 'false');

    await userEvent.click(screen.getByText('Write tests'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Title')).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});

describe('BoardPage cards', () => {
  it('creates a card in a column', async () => {
    api.boards.get.mockResolvedValue(boardAs('MEMBER'));
    api.cards.create.mockResolvedValue({});
    renderWithProviders(boardRoute, '/boards/b1');

    await userEvent.type(await screen.findByLabelText('New card in In Progress'), 'Review PR');
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Column In Progress' })).getByRole('button', {
        name: 'Add',
      })
    );

    expect(api.cards.create).toHaveBeenCalledWith('c2', { title: 'Review PR' });
  });

  it('edits a card in the dialog', async () => {
    api.boards.get.mockResolvedValue(boardAs('MEMBER'));
    api.cards.update.mockResolvedValue({});
    renderWithProviders(boardRoute, '/boards/b1');

    await userEvent.click(await screen.findByText('Write tests'));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Description'), 'Cover the move logic');
    fireEvent.change(within(dialog).getByLabelText('Deadline'), {
      target: { value: '2026-11-01' },
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.cards.update).toHaveBeenCalled());
    const [cardId, body] = api.cards.update.mock.calls[0] as [
      string,
      { description: string; deadline: string },
    ];
    expect(cardId).toBe('k1');
    expect(body.description).toBe('Cover the move logic');
    expect(new Date(body.deadline).getDate()).toBe(1);
  });

  it('moves a card by drag and drop and rolls back when the backend rejects it', async () => {
    api.boards.get.mockResolvedValue(boardAs('MEMBER'));
    let reject: (e: unknown) => void = () => undefined;
    api.cards.move.mockReturnValue(new Promise((_, r) => (reject = r)));
    renderWithProviders(boardRoute, '/boards/b1');

    const card = (await screen.findByText('Write tests')).closest('li') as HTMLElement;
    const done = screen.getByRole('region', { name: 'Column Done' });
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.dragOver(done);
    fireEvent.drop(done);

    await waitFor(() => expect(within(done).getByText('Write tests')).toBeInTheDocument());
    expect(api.cards.move).toHaveBeenCalledWith('k1', { columnId: 'c3', position: 0 });

    reject(new ApiError(400, ['Position must be between 0 and 0']));
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Column To Do' })).getByText('Write tests')
      ).toBeInTheDocument()
    );
  });

  it('moves a card with the keyboard-accessible column select', async () => {
    api.boards.get.mockResolvedValue(boardAs('MEMBER'));
    api.cards.move.mockResolvedValue({});
    renderWithProviders(boardRoute, '/boards/b1');

    await userEvent.click(await screen.findByText('Write tests'));
    await userEvent.selectOptions(
      within(screen.getByRole('dialog')).getByLabelText('Column'),
      'c2'
    );

    expect(api.cards.move).toHaveBeenCalledWith('k1', { columnId: 'c2', position: 0 });
  });
});

describe('BoardPage columns', () => {
  it('adds a column and moves one to the right', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    api.columns.create.mockResolvedValue({});
    api.columns.reorder.mockResolvedValue([]);
    renderWithProviders(boardRoute, '/boards/b1');

    await userEvent.type(await screen.findByLabelText('New column title'), 'Review');
    await userEvent.click(screen.getByRole('button', { name: 'Add column' }));
    expect(api.columns.create).toHaveBeenCalledWith('b1', { title: 'Review' });

    await userEvent.click(screen.getByRole('button', { name: 'Move column To Do right' }));
    expect(api.columns.reorder).toHaveBeenCalledWith('c1', 1);
  });

  it('deletes a column only after confirmation', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    api.columns.delete.mockResolvedValue(undefined);
    renderWithProviders(boardRoute, '/boards/b1');

    const column = await screen.findByRole('region', { name: 'Column Done' });
    await userEvent.click(within(column).getByRole('button', { name: 'Delete' }));
    expect(api.columns.delete).not.toHaveBeenCalled();
    await userEvent.click(within(column).getByRole('button', { name: 'Confirm delete' }));
    expect(api.columns.delete).toHaveBeenCalledWith('c3');
  });
});
