import { screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { commentsApi } from '../../api/endpoints';
import { renderWithProviders } from '../../test-utils';
import { CardComments } from './CardComments';

vi.mock('../../api/endpoints', () => ({
  commentsApi: { list: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));
vi.mock('../auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

const list = commentsApi.list as unknown as Mock;
const NOW = new Date('2026-11-26T12:00:00.000Z');

const comment = (syncedToJira: boolean, ageMs: number) => ({
  id: 'com1',
  cardId: 'c1',
  authorId: 'u1',
  text: 'Hello',
  syncedToJira,
  createdAt: new Date(NOW.getTime() - ageMs).toISOString(),
});

const renderComments = (jiraIssueKey: string | null = 'KAN-1') =>
  renderWithProviders(
    <CardComments cardId="c1" canEdit isAdmin={false} members={[]} jiraIssueKey={jiraIssueKey} />
  );

describe('CardComments Jira sync indicator', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    list.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows "Synced to Jira" for a mirrored comment', async () => {
    list.mockResolvedValue({ items: [comment(true, 60_000)] });
    renderComments();
    expect(await screen.findByText(/Synced to Jira/)).toBeInTheDocument();
  });

  it('shows "Jira sync pending" while the mirror is still within its budget', async () => {
    list.mockResolvedValue({ items: [comment(false, 1_000)] });
    renderComments();
    expect(await screen.findByText(/Jira sync pending/)).toBeInTheDocument();
    expect(screen.queryByText(/Not synced to Jira/)).not.toBeInTheDocument();
  });

  it('shows "Not synced to Jira" for an old comment that never synced', async () => {
    list.mockResolvedValue({ items: [comment(false, 60_000)] });
    renderComments();
    expect(await screen.findByText(/Not synced to Jira/)).toBeInTheDocument();
    expect(screen.queryByText(/Jira sync pending/)).not.toBeInTheDocument();
  });

  it('turns pending into failed after the grace and refetches once', async () => {
    list.mockResolvedValue({ items: [comment(false, 1_000)] });
    renderComments();
    expect(await screen.findByText(/Jira sync pending/)).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(await screen.findByText(/Not synced to Jira/)).toBeInTheDocument();
    expect(screen.queryByText(/Jira sync pending/)).not.toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('shows nothing about Jira on a card that is not linked', async () => {
    list.mockResolvedValue({
      items: [comment(false, 60_000), { ...comment(true, 5_000), id: 'com2' }],
    });
    renderComments(null);
    await screen.findAllByText('Hello');
    expect(screen.queryByText(/Jira/)).not.toBeInTheDocument();
  });
});
