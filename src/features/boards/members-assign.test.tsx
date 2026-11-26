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
  useWebSocket: () => ({
    joinBoard: vi.fn(),
    leaveBoard: vi.fn(),
    on: vi.fn(() => vi.fn()),
    onConnect: vi.fn(() => vi.fn()),
    status: 'connected',
  }),
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
    expect(within(panel).getByLabelText('Role of alice')).toHaveValue('ADMIN');
    expect(within(panel).getByLabelText('Role of bob')).toHaveValue('MEMBER');
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
    await userEvent.click(within(bobRow).getByRole('button', { name: 'Remove bob' }));
    await userEvent.click(within(bobRow).getByRole('button', { name: 'Confirm remove bob' }));
    expect(api.members.remove).toHaveBeenCalledWith('b1', 'u-bob');
  });

  it('shows the new role in the list after the Admin changes it', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    let bobRole: BoardRole = 'MEMBER';
    api.members.list.mockImplementation(() => [MEMBERS[0], { ...MEMBERS[1], role: bobRole }]);
    api.members.changeRole.mockImplementation(() => {
      bobRole = 'VIEWER';
      return member('u-bob', 'bob', 'VIEWER');
    });
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (2)' }));
    const panel = screen.getByRole('region', { name: 'Board members' });
    await userEvent.selectOptions(within(panel).getByLabelText('Role of bob'), 'VIEWER');

    await waitFor(() =>
      expect(within(panel).getByLabelText('Role of bob')).toHaveValue('VIEWER')
    );
  });

  it('keeps the member when the Admin cancels the removal', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (2)' }));
    const panel = screen.getByRole('region', { name: 'Board members' });
    const bobRow = within(panel).getByText('bob').closest('li') as HTMLElement;
    await userEvent.click(within(bobRow).getByRole('button', { name: 'Remove bob' }));
    await userEvent.click(within(bobRow).getByRole('button', { name: 'Cancel' }));

    expect(api.members.remove).not.toHaveBeenCalled();
    expect(within(panel).getByText('bob')).toBeInTheDocument();
    expect(within(bobRow).getByRole('button', { name: 'Remove bob' })).toBeInTheDocument();
  });

  it('shows a Member the list with roles and no management controls', async () => {
    api.boards.get.mockResolvedValue(boardAs('MEMBER'));
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (2)' }));
    const panel = screen.getByRole('region', { name: 'Board members' });
    expect(within(panel).getByText('alice')).toBeInTheDocument();
    expect(within(panel).getByText('bob')).toBeInTheDocument();
    expect(within(panel).getByText('ADMIN')).toBeInTheDocument();
    expect(within(panel).getByText('MEMBER')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText('Role of bob')).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it('shows a Viewer the list with roles and no management controls', async () => {
    api.boards.get.mockResolvedValue(boardAs('VIEWER'));
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (2)' }));
    const panel = screen.getByRole('region', { name: 'Board members' });
    expect(within(panel).getByText('alice')).toBeInTheDocument();
    expect(within(panel).getByText('bob')).toBeInTheDocument();
    expect(within(panel).getByText('ADMIN')).toBeInTheDocument();
    expect(within(panel).getByText('MEMBER')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText('Role of bob')).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it('shows a loading message until the members arrive', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    api.members.list.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (0)' }));
    expect(
      within(screen.getByRole('region', { name: 'Board members' })).getByRole('status')
    ).toHaveTextContent('Loading members...');
  });

  it('takes the Admin controls away at once when the Admin demotes themselves', async () => {
    const carol = member('u-carol', 'carol', 'ADMIN');
    let myRole: BoardRole = 'ADMIN';
    let aliceRole: BoardRole = 'ADMIN';
    api.boards.get.mockImplementation(() => boardAs(myRole));
    api.members.list.mockImplementation(() => [
      { ...MEMBERS[0], role: aliceRole },
      MEMBERS[1],
      carol,
    ]);
    api.members.changeRole.mockImplementation(() => {
      myRole = 'MEMBER';
      aliceRole = 'MEMBER';
      return member('u-admin', 'alice', 'MEMBER');
    });
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (3)' }));
    const panel = screen.getByRole('region', { name: 'Board members' });
    await userEvent.selectOptions(within(panel).getByLabelText('Role of alice'), 'MEMBER');

    await waitFor(() =>
      expect(within(panel).queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument()
    );
    expect(within(panel).queryByLabelText('Role of bob')).not.toBeInTheDocument();
    expect(api.boards.get).toHaveBeenCalledTimes(2);
  });

  it('refetches the board and drops the controls when an invite answers 403', async () => {
    let myRole: BoardRole = 'ADMIN';
    api.boards.get.mockImplementation(() => boardAs(myRole));
    api.members.invite.mockImplementation(() => {
      myRole = 'MEMBER';
      return Promise.reject(new Error('Only a board admin can do this'));
    });
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (2)' }));
    const panel = screen.getByRole('region', { name: 'Board members' });
    await userEvent.type(
      within(panel).getByLabelText('E-mail of a registered user'),
      'carol@example.com'
    );
    await userEvent.click(within(panel).getByRole('button', { name: 'Invite' }));

    await waitFor(() =>
      expect(within(panel).queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument()
    );
    expect(api.boards.get).toHaveBeenCalledTimes(2);
  });

  it('disables demote and remove for the only Admin, with a reason', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (2)' }));
    const panel = screen.getByRole('region', { name: 'Board members' });
    const select = within(panel).getByLabelText('Role of alice');
    expect(select).toBeDisabled();
    expect(select).toHaveAttribute('title', expect.stringContaining('only Admin'));
    expect(within(panel).getByRole('button', { name: 'Remove alice' })).toBeDisabled();
    expect(within(panel).getByRole('button', { name: 'Remove bob' })).toBeEnabled();
  });

  it('shows an error with a retry when the member list fails to load', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    api.members.list.mockRejectedValue(new Error('boom'));
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (0)' }));
    const retry = await screen.findByRole('button', { name: 'Retry' });
    api.members.list.mockResolvedValue(MEMBERS);
    await userEvent.click(retry);
    expect(await screen.findByText('bob')).toBeInTheDocument();
  });

  it('shows an empty message when the board has no members', async () => {
    api.boards.get.mockResolvedValue(boardAs('ADMIN'));
    api.members.list.mockResolvedValue([]);
    renderWithProviders(route, '/boards/b1');

    await userEvent.click(await screen.findByRole('button', { name: 'Members (0)' }));
    expect(await screen.findByText('No members.')).toBeInTheDocument();
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
