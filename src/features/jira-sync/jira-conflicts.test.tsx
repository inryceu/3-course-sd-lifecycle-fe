import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JiraConflictsPanel } from './JiraConflictsPanel';
import { jiraApi } from '../../api/endpoints';

vi.mock('../../api/endpoints', () => ({
  jiraApi: { conflicts: vi.fn(), resolveConflict: vi.fn() },
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('JiraConflictsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders conflicts and allows resolving', async () => {
    const user = userEvent.setup();
    (jiraApi.conflicts as any).mockResolvedValue({
      items: [
        {
          id: 'conf1',
          boardId: 'b1',
          cardId: 'c1',
          jiraIssueKey: 'KAN-10',
          boardStatus: 'TODO',
          jiraStatus: 'IN PROGRESS',
          detectedAt: '2023-01-01T00:00:00Z',
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JiraConflictsPanel board={{ id: 'b1', title: 'Board', myRole: 'ADMIN' } as any} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Card KAN-10')).toBeInTheDocument());

    const pushBtn = screen.getByRole('button', { name: /Push Board version/i });
    await user.click(pushBtn);

    expect(jiraApi.resolveConflict).toHaveBeenCalledWith('conf1', 'BOARD');
  });
});
