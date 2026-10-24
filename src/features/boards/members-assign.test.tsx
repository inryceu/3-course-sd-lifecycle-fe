import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import type { BoardDetail, BoardRole, Member } from '../../api/schema';
import { renderWithProviders } from '../../test-utils';
import { BoardPage } from './BoardPage';

const api = vi.hoisted(() => ({
  boards: { get: vi.fn() },
  columns: {},
  cards: { assign: vi.fn(), update: vi.fn(), delete: vi.fn(), move: vi.fn() },
  members: { list: vi.fn(), invite: vi.fn(), changeRole: vi.fn(), remove: vi.fn() },
}));
vi.mock('../../api/endpoints', () => ({
  boardsApi: api.boards,
  columnsApi: api.columns,
  cardsApi: api.cards,
  membersApi: api.members,
}));
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({ joinBoard: vi.fn(), leaveBoard: vi.fn(), on: () => () => undefined }),
}));
vi.mock('../auth', () => ({ useAuth: () => ({ user: { id: 'u-admin' } }) }));

const member = (userId: string, displayName: string, role: BoardRole): Member => ({
  boardId: 'b1',
  userId,
  displayName,
  email: `${displayName}@example.com`,
  role,
  invitedAt: '',
});
const MEMBERS = [member('u-admin', 'alice', 'ADMIN'), member('u-bob', 'bob', 'MEMBER')];

function boardAs(myRole: BoardRole, assigneeId: string | null = null): BoardDetail {
  return {
    id: 'b1',
    title: 'Team board',
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
          {
            id: 'k1',
            boardId: 'b1',
            columnId: 'c1',
            title: 'Write tests',
            position: 0,
            labelIds: [],
            assigneeId,
            createdAt: '',
            updatedAt: '',
          },
        ],
      },
    ],
  };
}

const route = (
  <Routes>
    <Route path="/boards/:boardId" element={<BoardPage />} />
  </Routes>
);

beforeEach(() => {
  Object.values(api).forEach((group) =>
    Object.values(group as Record<string, ReturnType<typeof vi.fn>>).forEach((fn) => fn.mockReset())
  );
  api.members.list.mockResolvedValue(MEMBERS);
});

describe('Members panel', () => {
  it('lets the Admin invite, change a role and remove a member', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    api.members.invite.mockResolvedValue(member('u-carol', 'carol', 'VIEWER'));
    api.members.changeRole.mockResolvedValue(member('u-bob', 'bob', 'VIEWER'));
    api.members.remove.mockResolvedValue(undefined);
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (2)' }));
    const panel = screen.getByRole('region', { name: 'Board members' });
    await userEvent.type(
      within(panel).getByLabelText('E-mail of a registered user'),
      'carol@example.com'
    );
    await userEvent.selectOptions(within(panel).getByLabelText('Invite as'), 'VIEWER');
    await userEvent.click(within(panel).getByRole('button', { name: 'Invite' }));
    expect(api.members.invite).toHaveBeenCalledWith('b1', {
      email: 'carol@example.com',
      role: 'VIEWER',
    });

    await userEvent.selectOptions(within(panel).getByLabelText('Role of bob'), 'VIEWER');
    expect(api.members.changeRole).toHaveBeenCalledWith('b1', 'u-bob', 'VIEWER');

    const bobRow = within(panel).getByText('bob').closest('li') as HTMLElement;
    await userEvent.click(within(bobRow).getByRole('button', { name: 'Remove' }));
    await userEvent.click(within(bobRow).getByRole('button', { name: 'Confirm remove' }));
    expect(api.members.remove).toHaveBeenCalledWith('b1', 'u-bob');
  });

  it('shows a Member the list without management controls', async () => {
    api.boards.get.mockResolvedValue(boardAs('MEMBER'));
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (2)' }));
    const panel = screen.getByRole('region', { name: 'Board members' });
    expect(within(panel).getByText('bob')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText('Role of bob')).not.toBeInTheDocument();
  });
});

describe('Card assignee', () => {
  it('assigns a member and clears the assignee from the card dialog', async () => {
    api.boards.get.mockResolvedValue(boardAs('MEMBER'));
    api.cards.assign.mockResolvedValue({});
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByText('Write tests'));
    const dialog = screen.getByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getByRole('option', { name: 'bob' })).toBeInTheDocument()
    );
    await userEvent.selectOptions(within(dialog).getByLabelText('Assignee'), 'u-bob');
    expect(api.cards.assign).toHaveBeenCalledWith('k1', 'u-bob');

    await userEvent.selectOptions(within(dialog).getByLabelText('Assignee'), '');
    expect(api.cards.assign).toHaveBeenLastCalledWith('k1', null);
  });

  it('shows the assignee on the card and read-only to a Viewer', async () => {
    api.boards.get.mockResolvedValue(boardAs('VIEWER', 'u-bob'));
    renderWithProviders(route, '/boards/b1');

    expect(await screen.findByText('@bob')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Write tests'));
    expect(within(screen.getByRole('dialog')).getByLabelText('Assignee')).toBeDisabled();
  });
});
