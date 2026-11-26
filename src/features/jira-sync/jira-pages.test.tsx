import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../api/client';
import { renderWithProviders } from '../../test-utils';
import { JiraSyncPage, JIRA_BOARD_KEY } from './JiraSyncPage';
import { JiraCallbackPage } from './JiraCallbackPage';

const api = vi.hoisted(() => ({
  boards: { list: vi.fn(), get: vi.fn() },
  jira: {
    startOAuth: vi.fn(),
    completeOAuth: vi.fn(),
    connection: vi.fn(),
    disconnect: vi.fn(),
    syncLogs: vi.fn(),
    conflicts: vi.fn(),
  },
}));
vi.mock('../../api/endpoints', () => ({ boardsApi: api.boards, jiraApi: api.jira }));

beforeEach(() => {
  [...Object.values(api.boards), ...Object.values(api.jira)].forEach((fn) => fn.mockReset());
  api.boards.get.mockResolvedValue({ id: 'b', columns: [] });
  sessionStorage.clear();
});

describe('JiraSyncPage', () => {
  it('shows the status per board and sends the Admin to Atlassian', async () => {
    api.boards.list.mockResolvedValue([
      { id: 'b1', title: 'Mine', myRole: 'ADMIN', createdAt: '', updatedAt: '' },
      { id: 'b2', title: 'Shared', myRole: 'MEMBER', createdAt: '', updatedAt: '' },
    ]);
    api.jira.connection.mockImplementation((boardId: string) =>
      Promise.resolve(
        boardId === 'b2'
          ? { connected: true, boardId, siteUrl: 'https://team.atlassian.net', scopes: [] }
          : { connected: false, boardId, scopes: [] }
      )
    );
    api.jira.startOAuth.mockResolvedValue({
      authorizeUrl: 'https://auth.atlassian.com/authorize?x=1',
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    renderWithProviders(<JiraSyncPage />);

    const shared = await screen.findByRole('listitem', { name: 'Jira connection of Shared' });
    expect(await within(shared).findByText('https://team.atlassian.net')).toBeInTheDocument();
    expect(within(shared).queryByRole('button')).not.toBeInTheDocument();

    const mine = screen.getByRole('listitem', { name: 'Jira connection of Mine' });
    await userEvent.click(await within(mine).findByRole('button', { name: 'Connect Jira' }));

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://auth.atlassian.com/authorize?x=1')
    );
    expect(sessionStorage.getItem(JIRA_BOARD_KEY)).toBe('b1');
    vi.unstubAllGlobals();
  });
});

describe('JiraSyncPage reconnect banner', () => {
  const connected = (requiresReconnect: boolean, role: 'ADMIN' | 'MEMBER' = 'ADMIN') => {
    api.boards.list.mockResolvedValue([
      { id: 'b1', title: 'Mine', myRole: role, createdAt: '', updatedAt: '' },
    ]);
    api.boards.get.mockResolvedValue({ id: 'b1', columns: [] });
    api.jira.connection.mockResolvedValue({
      connected: true,
      boardId: 'b1',
      siteUrl: 'https://team.atlassian.net',
      scopes: [],
      requiresReconnect,
    });
    api.jira.syncLogs.mockResolvedValue({ items: [], nextCursor: null });
    api.jira.conflicts.mockResolvedValue({ items: [], nextCursor: null });
  };

  it('tells the Admin the connection is dead and lets them reconnect without disconnecting', async () => {
    connected(true);
    api.jira.startOAuth.mockResolvedValue({ authorizeUrl: 'https://auth.atlassian.com/x' });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    renderWithProviders(<JiraSyncPage />);

    expect(await screen.findByText('Jira no longer accepts this connection')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reconnect Jira' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://auth.atlassian.com/x'));
    expect(api.jira.startOAuth).toHaveBeenCalledWith('b1');
    expect(api.jira.disconnect).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('shows a member the warning without a reconnect button', async () => {
    connected(true, 'MEMBER');

    renderWithProviders(<JiraSyncPage />);

    expect(await screen.findByText('Jira no longer accepts this connection')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reconnect Jira' })).not.toBeInTheDocument();
  });

  it('shows no warning for a healthy connection', async () => {
    connected(false);

    renderWithProviders(<JiraSyncPage />);

    await screen.findByText('https://team.atlassian.net');
    expect(screen.queryByText('Jira no longer accepts this connection')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reconnect Jira' })).not.toBeInTheDocument();
  });

  it('shows no warning when Jira is not connected', async () => {
    api.boards.list.mockResolvedValue([
      { id: 'b1', title: 'Mine', myRole: 'ADMIN', createdAt: '', updatedAt: '' },
    ]);
    api.jira.connection.mockResolvedValue({
      connected: false,
      boardId: 'b1',
      scopes: [],
      requiresReconnect: false,
    });

    renderWithProviders(<JiraSyncPage />);

    await screen.findByRole('button', { name: 'Connect Jira' });
    expect(screen.queryByText('Jira no longer accepts this connection')).not.toBeInTheDocument();
  });
});

describe('JiraCallbackPage', () => {
  it('completes the flow once and shows the site', async () => {
    sessionStorage.setItem(JIRA_BOARD_KEY, 'b1');
    api.jira.completeOAuth.mockResolvedValue({
      connected: true,
      cloudId: 'c',
      siteUrl: 'https://team.atlassian.net',
    });

    renderWithProviders(<JiraCallbackPage />, '/jira/callback?code=abc&state=s1');

    expect(await screen.findByText('https://team.atlassian.net')).toBeInTheDocument();
    expect(api.jira.completeOAuth).toHaveBeenCalledTimes(1);
    expect(api.jira.completeOAuth).toHaveBeenCalledWith({
      state: 's1',
      code: 'abc',
      error: undefined,
    });
    expect(screen.getByRole('link', { name: 'Open the board' })).toHaveAttribute(
      'href',
      '/boards/b1'
    );
  });

  it('shows a denied consent as a failure and keeps the link to the board', async () => {
    sessionStorage.setItem(JIRA_BOARD_KEY, 'b1');
    api.jira.completeOAuth.mockRejectedValue(new ApiError(400, ['Jira authorisation was denied']));

    renderWithProviders(<JiraCallbackPage />, '/jira/callback?error=access_denied&state=s1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Jira authorisation was denied');
    expect(screen.getByRole('link', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the board' })).toHaveAttribute(
      'href',
      '/boards/b1'
    );
    expect(sessionStorage.getItem(JIRA_BOARD_KEY)).toBeNull();
  });
});
