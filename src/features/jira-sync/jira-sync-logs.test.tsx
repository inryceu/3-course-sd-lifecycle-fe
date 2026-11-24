import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { JiraSyncLog } from '../../api/schema';
import { JiraSyncLogsPanel } from './JiraSyncLogsPanel';

const api = vi.hoisted(() => ({
  jira: { syncLogs: vi.fn(), retrySyncLog: vi.fn() },
}));

vi.mock('../../api/endpoints', () => ({
  jiraApi: {
    syncLogs: api.jira.syncLogs,
    retrySyncLog: api.jira.retrySyncLog,
  },
}));

const mockLogs: JiraSyncLog[] = [
  {
    id: 'log-1',
    boardId: 'board-1',
    direction: 'TO_JIRA',
    status: 'FAILED',
    payload: {
      issueKey: 'KAN-1',
      cardId: 'card-1',
      fromColumnId: 'col-1',
      toColumnId: 'col-2',
      outcome: 'transitioned',
    },
    errorMessage: 'Rate limited',
    mappingId: 'mapping-1',
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'log-2',
    boardId: 'board-1',
    direction: 'TO_JIRA',
    status: 'SUCCESS',
    payload: {
      issueKey: 'KAN-2',
      cardId: 'card-2',
      outcome: 'no-op',
    },
    errorMessage: null,
    mappingId: 'mapping-2',
    createdAt: '2026-01-15T09:00:00.000Z',
  },
  {
    id: 'log-3',
    boardId: 'board-1',
    direction: 'FROM_JIRA',
    status: 'CONFLICT',
    payload: {
      issueKey: 'KAN-3',
      cardId: 'card-3',
    },
    errorMessage: null,
    mappingId: 'mapping-3',
    createdAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'log-4',
    boardId: 'board-1',
    direction: 'TO_JIRA',
    status: 'FAILED',
    payload: {
      issueKey: 'KAN-4',
      cardId: 'card-4',
      outcome: 'unknown',
    },
    errorMessage: 'Timeout',
    mappingId: 'mapping-4',
    createdAt: '2026-01-15T07:00:00.000Z',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderPanel(options: { logs?: JiraSyncLog[] } = {}) {
  const { logs = mockLogs } = options;

  api.jira.syncLogs.mockResolvedValue({ items: logs, nextCursor: null });
  api.jira.retrySyncLog.mockResolvedValue({ status: 'SUCCESS', reason: null });

  return render(
    <JiraSyncLogsPanel board={{ id: 'board-1', title: 'Test Board' } as any} />,
    { wrapper: createWrapper() }
  );
}

describe('JiraSyncLogsPanel', () => {
  beforeEach(() => {
    api.jira.syncLogs.mockClear();
    api.jira.retrySyncLog.mockClear();
  });

  it('renders status filter tabs', async () => {
    renderPanel();

    await screen.findByRole('button', { name: 'ALL' });
    expect(screen.getByRole('button', { name: 'FAILED' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CONFLICT' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SUCCESS' })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    api.jira.syncLogs.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <JiraSyncLogsPanel board={{ id: 'board-1' } as any} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Loading sync logs...')).toBeInTheDocument();
  });

it('displays sync logs with status badges', async () => {
    renderPanel();

    await screen.findByText('log-1'.slice(0, 8));
    await screen.findByText('log-2'.slice(0, 8));
    await screen.findByText('log-3'.slice(0, 8));

    // Check status badges - there are multiple FAILED logs + filter tabs
    const failedBadges = await screen.findAllByText('FAILED');
    expect(failedBadges.length).toBe(3);
    const successBadges = await screen.findAllByText('SUCCESS');
    expect(successBadges.length).toBe(2);
    const conflictBadges = await screen.findAllByText('CONFLICT');
    expect(conflictBadges.length).toBe(2);
  });

  it('displays direction badges', async () => {
    renderPanel();

    const toJiraBadges = await screen.findAllByText('→ Jira');
    const fromJiraBadges = await screen.findAllByText('← Jira');
    expect(toJiraBadges.length).toBe(3);
    expect(fromJiraBadges.length).toBe(1);
  });

  it('filters logs by status when clicking tabs', async () => {
    renderPanel();

    await screen.findByRole('button', { name: 'FAILED' });
    userEvent.click(screen.getByRole('button', { name: 'FAILED' }));

    // Should show only FAILED logs (log-1 and log-4)
    await screen.findByText('KAN-1');
    await screen.findByText('KAN-4');
    expect(screen.queryByText('KAN-2')).not.toBeInTheDocument();
    expect(screen.queryByText('KAN-3')).not.toBeInTheDocument();

    // Click ALL filter
    userEvent.click(screen.getByRole('button', { name: 'ALL' }));

    await screen.findByText('KAN-1');
    await screen.findByText('KAN-2');
    await screen.findByText('KAN-3');
    await screen.findByText('KAN-4');
  });

  it('shows error message for failed logs', async () => {
    renderPanel();

    await screen.findByText('Rate limited');
    await screen.findByText('Timeout');
  });

  it('shows Retry button only for retryable failed logs', async () => {
    renderPanel();

    await screen.findByRole('button', { name: /Retry/i });
    const retryButtons = screen.getAllByRole('button', { name: /Retry/i });
    expect(retryButtons.length).toBe(1); // Only log-1 should have Retry button
  });

  it('does not show Retry button for non-retryable logs', async () => {
    renderPanel();

    await screen.findByRole('button', { name: /Retry/i });
    const retryButtons = screen.getAllByRole('button', { name: /Retry/i });
    expect(retryButtons.length).toBe(1);
  });

  it('calls retry API when Retry button is clicked', async () => {
    renderPanel();

    const retryButton = await screen.findByRole('button', { name: 'Retry' });
    userEvent.click(retryButton);

    await waitFor(() => {
      expect(api.jira.retrySyncLog).toHaveBeenCalledWith('log-1');
    });
  });

  it('shows issue key and card id for logs', async () => {
    renderPanel();

    await screen.findByText('KAN-1');
    await screen.findByText('Card: card-1');
  });
});