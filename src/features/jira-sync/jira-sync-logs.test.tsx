import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../../api/client';
import type { Board, JiraSyncLog } from '../../api/schema';
import { renderWithProviders } from '../../test-utils';
import { JiraSyncLogsPanel } from './JiraSyncLogsPanel';

const api = vi.hoisted(() => ({
  boards: { get: vi.fn() },
  jira: { syncLogs: vi.fn() },
}));
vi.mock('../../api/endpoints', () => ({ boardsApi: api.boards, jiraApi: api.jira }));

const board: Board = {
  id: 'board-1',
  title: 'Test Board',
  myRole: 'ADMIN',
  createdAt: '',
  updatedAt: '',
};

const log = (overrides: Partial<JiraSyncLog> & Pick<JiraSyncLog, 'id'>): JiraSyncLog => ({
  boardId: 'board-1',
  direction: 'TO_JIRA',
  status: 'SUCCESS',
  payload: {},
  errorMessage: null,
  mappingId: 'm1',
  createdAt: '2026-01-15T10:00:00.000Z',
  ...overrides,
});

const FAILED_MOVE = log({
  id: 'log-1',
  status: 'FAILED',
  payload: { issueKey: 'KAN-1', cardId: 'card-1', fromColumnId: 'col-a', toColumnId: 'col-b' },
  errorMessage: 'Rate limited',
});
const SUCCESS_MOVE = log({ id: 'log-2', payload: { issueKey: 'KAN-2', toColumnId: 'col-b' } });
const CONFLICT = log({
  id: 'log-3',
  direction: 'FROM_JIRA',
  status: 'CONFLICT',
  payload: { issueKey: 'KAN-3' },
});
const FAILED_COMMENT = log({
  id: 'log-4',
  status: 'FAILED',
  payload: { issueKey: 'KAN-4', commentId: 'com-1', cardId: 'card-4' },
  errorMessage: 'Timeout',
});
const ALL_LOGS = [FAILED_MOVE, SUCCESS_MOVE, CONFLICT, FAILED_COMMENT];

const renderPanel = (siteUrl: string | null = 'https://team.atlassian.net/') =>
  renderWithProviders(<JiraSyncLogsPanel board={board} siteUrl={siteUrl} />);

beforeEach(() => {
  api.boards.get.mockReset().mockResolvedValue({
    ...board,
    columns: [
      { id: 'col-a', title: 'To Do', cards: [] },
      { id: 'col-b', title: 'Done', cards: [] },
    ],
  });
  // Honours the server-side filter the way the backend does.
  api.jira.syncLogs
    .mockReset()
    .mockImplementation((_boardId: string, params?: { status?: string }) =>
      Promise.resolve({
        items: ALL_LOGS.filter((l) => !params?.status || l.status === params.status),
        nextCursor: null,
      })
    );
});

describe('JiraSyncLogsPanel', () => {
  it('lists logs with status, direction, error and column titles instead of ids', async () => {
    renderPanel();

    expect(await screen.findByText('Rate limited')).toBeInTheDocument();
    expect(screen.getByText('Timeout')).toBeInTheDocument();
    expect(await screen.findByText('from To Do → to Done')).toBeInTheDocument();
    expect(screen.getAllByText('→ Jira')).toHaveLength(3);
    expect(screen.getAllByText('← Jira')).toHaveLength(1);
    expect(screen.getByText('Comment sync')).toBeInTheDocument();
    expect(screen.queryByText(/log-1|card-1|col-a/)).not.toBeInTheDocument();
    expect(api.jira.syncLogs).toHaveBeenCalledWith('board-1', {
      status: undefined,
      cursor: undefined,
    });
  });

  it('links the issue key to the Jira site and has no dead "#" links', async () => {
    renderPanel();

    const link = await screen.findByRole('link', { name: 'KAN-1' });
    expect(link).toHaveAttribute('href', 'https://team.atlassian.net/browse/KAN-1');
    screen.getAllByRole('link').forEach((a) => expect(a.getAttribute('href')).not.toBe('#'));
  });

  it('shows the issue key as plain text when the site is unknown', async () => {
    renderPanel(null);

    expect(await screen.findByText('KAN-1')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('names a column that no longer exists', async () => {
    api.boards.get.mockResolvedValue({ ...board, columns: [] });
    renderPanel();

    expect(
      await screen.findByText('from a deleted column → to a deleted column')
    ).toBeInTheDocument();
  });

  it('offers no Retry action: status moves are retried by the outbox', async () => {
    renderPanel();

    await screen.findByText('Rate limited');
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('filters on the server: the status is a query argument and a new query runs', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('KAN-2');

    await user.click(screen.getByRole('button', { name: 'FAILED' }));

    await screen.findByText('KAN-4');
    expect(api.jira.syncLogs).toHaveBeenCalledTimes(2);
    expect(api.jira.syncLogs).toHaveBeenLastCalledWith('board-1', {
      status: 'FAILED',
      cursor: undefined,
    });
    expect(screen.queryByText('KAN-2')).not.toBeInTheDocument();
    expect(screen.queryByText('KAN-3')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ALL' }));
    expect(await screen.findByText('KAN-2')).toBeInTheDocument();
  });

  it('shows failed rows that sit beyond the first unfiltered page', async () => {
    const user = userEvent.setup();
    api.jira.syncLogs.mockImplementation((_id: string, params?: { status?: string }) =>
      Promise.resolve(
        params?.status === 'FAILED'
          ? { items: [FAILED_COMMENT], nextCursor: null }
          : { items: [SUCCESS_MOVE], nextCursor: 'cursor-unfiltered' }
      )
    );
    renderPanel();
    await screen.findByText('KAN-2');

    await user.click(screen.getByRole('button', { name: 'FAILED' }));

    expect(await screen.findByText('KAN-4')).toBeInTheDocument();
    expect(screen.queryByText('KAN-2')).not.toBeInTheDocument();
    // the unfiltered cursor is never sent with the filtered query
    expect(api.jira.syncLogs).toHaveBeenLastCalledWith('board-1', {
      status: 'FAILED',
      cursor: undefined,
    });
  });

  it('marks the active filter with aria-pressed', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('KAN-2');

    expect(screen.getByRole('button', { name: 'ALL' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'CONFLICT' }));

    expect(screen.getByRole('button', { name: 'CONFLICT' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'ALL' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('says so when a filter matches nothing', async () => {
    const user = userEvent.setup();
    api.jira.syncLogs.mockResolvedValue({ items: [], nextCursor: null });
    renderPanel();

    expect(await screen.findByText('No sync logs.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'CONFLICT' }));
    expect(await screen.findByText('No sync logs with status CONFLICT.')).toBeInTheDocument();
  });

  it('loads the next page with the cursor and hides Load more at the end', async () => {
    const user = userEvent.setup();
    api.jira.syncLogs.mockImplementation((_id: string, params?: { cursor?: string }) =>
      Promise.resolve(
        params?.cursor
          ? { items: [CONFLICT], nextCursor: null }
          : { items: [SUCCESS_MOVE], nextCursor: 'cursor-1' }
      )
    );
    renderPanel();
    await screen.findByText('KAN-2');

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('KAN-3')).toBeInTheDocument();
    expect(screen.getByText('KAN-2')).toBeInTheDocument();
    expect(api.jira.syncLogs).toHaveBeenLastCalledWith('board-1', {
      status: undefined,
      cursor: 'cursor-1',
    });
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows an alert when the logs cannot be loaded, and keeps the filters usable', async () => {
    api.jira.syncLogs.mockRejectedValue(new ApiError(500, ['boom']));
    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load sync logs');
    expect(screen.getByRole('button', { name: 'FAILED' })).toBeEnabled();
  });

  it('shows an alert when the next page fails and keeps the loaded rows', async () => {
    const user = userEvent.setup();
    api.jira.syncLogs.mockImplementation((_id: string, params?: { cursor?: string }) =>
      params?.cursor
        ? Promise.reject(new ApiError(403, ['Only board admins can view sync logs']))
        : Promise.resolve({ items: [SUCCESS_MOVE], nextCursor: 'cursor-1' })
    );
    renderPanel();
    await screen.findByText('KAN-2');

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only board admins');
    expect(screen.getByText('KAN-2')).toBeInTheDocument();
  });
});
