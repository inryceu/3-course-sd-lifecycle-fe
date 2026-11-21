import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { Board, JiraConflict } from '../../api/schema';
import { ApiError } from '../../api/client';
import { renderWithProviders } from '../../test-utils';
import { JiraConflictsPanel } from './JiraConflictsPanel';
import { JiraSyncPage } from './JiraSyncPage';

const api = vi.hoisted(() => ({
  boards: { list: vi.fn() },
  jira: { conflicts: vi.fn(), resolveConflict: vi.fn(), connection: vi.fn() },
}));
vi.mock('../../api/endpoints', () => ({
  boardsApi: api.boards,
  jiraApi: {
    ...api.jira,
    projects: () => Promise.resolve([]),
    statusMappings: () => Promise.resolve([]),
  },
}));

const board = { id: 'b1', title: 'Board', myRole: 'ADMIN' } as Board;

const conflict = (id: string, resolvedAt: string | null = null): JiraConflict => ({
  id,
  boardId: 'b1',
  cardId: `card-${id}`,
  jiraIssueKey: `KAN-${id}`,
  boardColumnId: 'c1',
  boardStatus: 'To Do',
  boardChangedAt: '2026-11-01T10:00:00Z',
  jiraColumnId: 'c2',
  jiraStatus: 'In Progress',
  jiraChangedAt: '2026-11-01T10:00:02Z',
  detectedAt: '2026-11-01T10:00:03Z',
  resolution: 'jira',
  resolvedAt,
  resolvedById: null,
});

beforeEach(() => {
  [...Object.values(api.boards), ...Object.values(api.jira)].forEach((fn) => fn.mockReset());
});

describe('JiraConflictsPanel', () => {
  it('sends the contract values, refreshes the list and the board', async () => {
    api.jira.conflicts.mockResolvedValue({ items: [conflict('1')], nextCursor: null });
    api.jira.resolveConflict.mockResolvedValue(conflict('1', '2026-11-02T00:00:00Z'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    render(
      <QueryClientProvider client={client}>
        <JiraConflictsPanel board={board} />
      </QueryClientProvider>
    );

    await screen.findByText('Card KAN-1');
    await userEvent.click(screen.getByRole('button', { name: 'Push Board version' }));
    expect(api.jira.resolveConflict).toHaveBeenCalledWith('1', 'boardsync');

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['board', 'b1'] }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep Jira version' }));
    expect(api.jira.resolveConflict).toHaveBeenLastCalledWith('1', 'jira');
  });

  it('lists only unresolved conflicts', async () => {
    api.jira.conflicts.mockResolvedValue({
      items: [conflict('1', '2026-11-02T00:00:00Z'), conflict('2')],
      nextCursor: null,
    });
    renderWithProviders(<JiraConflictsPanel board={board} />);

    expect(await screen.findByText('Card KAN-2')).toBeInTheDocument();
    expect(screen.queryByText('Card KAN-1')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Keep Jira version' })).toHaveLength(1);
  });

  it('follows nextCursor with Load more', async () => {
    api.jira.conflicts.mockImplementation((_boardId: string, cursor?: string) =>
      Promise.resolve(
        cursor
          ? { items: [conflict('2')], nextCursor: null }
          : { items: [conflict('1')], nextCursor: 'cur-1' }
      )
    );
    renderWithProviders(<JiraConflictsPanel board={board} />);

    await screen.findByText('Card KAN-1');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Card KAN-2')).toBeInTheDocument();
    expect(api.jira.conflicts).toHaveBeenLastCalledWith('b1', 'cur-1');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    api.jira.conflicts.mockResolvedValue({ items: [], nextCursor: null });
    renderWithProviders(<JiraConflictsPanel board={board} />);
    expect(await screen.findByText('No sync conflicts.')).toBeInTheDocument();
  });

  it('shows a load error instead of an empty list', async () => {
    api.jira.conflicts.mockRejectedValue(new ApiError(500, ['boom']));
    renderWithProviders(<JiraConflictsPanel board={board} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load sync conflicts');
    expect(screen.queryByText('No sync conflicts.')).not.toBeInTheDocument();
  });

  it('shows a resolve error and disables only the clicked row while pending', async () => {
    api.jira.conflicts.mockResolvedValue({
      items: [conflict('1'), conflict('2')],
      nextCursor: null,
    });
    let fail: (e: unknown) => void = () => undefined;
    api.jira.resolveConflict.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    renderWithProviders(<JiraConflictsPanel board={board} />);

    await screen.findByText('Card KAN-1');
    const rows = screen.getAllByRole('listitem');
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Keep Jira version' }));
    expect(within(rows[0]).getByRole('button', { name: 'Keep Jira version' })).toBeDisabled();
    expect(within(rows[1]).getByRole('button', { name: 'Keep Jira version' })).toBeEnabled();

    fail(new ApiError(409, ['The conflict is already resolved']));
    expect(await screen.findByRole('alert')).toHaveTextContent('already resolved');
  });
});

describe('JiraSyncPage conflicts gate', () => {
  const boards = [
    { id: 'b1', title: 'Mine', myRole: 'ADMIN', createdAt: '', updatedAt: '' },
    { id: 'b2', title: 'Shared', myRole: 'MEMBER', createdAt: '', updatedAt: '' },
    { id: 'b3', title: 'Watching', myRole: 'VIEWER', createdAt: '', updatedAt: '' },
  ];

  it('mounts the conflicts panel for Admins only', async () => {
    api.boards.list.mockResolvedValue(boards);
    api.jira.connection.mockImplementation((boardId: string) =>
      Promise.resolve({ connected: true, boardId, siteUrl: 'https://t.atlassian.net', scopes: [] })
    );
    api.jira.conflicts.mockResolvedValue({ items: [], nextCursor: null });
    renderWithProviders(<JiraSyncPage />);

    const mine = await screen.findByRole('listitem', { name: 'Jira connection of Mine' });
    expect(await within(mine).findByText('Sync conflicts')).toBeInTheDocument();
    for (const title of ['Shared', 'Watching']) {
      const row = screen.getByRole('listitem', { name: `Jira connection of ${title}` });
      await within(row).findByText('https://t.atlassian.net');
      expect(within(row).queryByText('Sync conflicts')).not.toBeInTheDocument();
    }
    expect(api.jira.conflicts).toHaveBeenCalledTimes(1);
    expect(api.jira.conflicts).toHaveBeenCalledWith('b1', undefined);
  });
});
