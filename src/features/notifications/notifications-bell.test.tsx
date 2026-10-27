import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Notification } from '../../api/schema';
import type { RealtimeEvent } from '../../hooks/useWebSocket';
import { renderWithProviders } from '../../test-utils';
import { NotificationsBell } from './NotificationsBell';

const api = vi.hoisted(() => ({ list: vi.fn(), markRead: vi.fn() }));
const socket = vi.hoisted(() => ({ handlers: new Map<string, (event: unknown) => void>() }));
vi.mock('../../api/endpoints', () => ({ notificationsApi: api }));
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    joinBoard: vi.fn(),
    leaveBoard: vi.fn(),
    on: (type: string, handler: (event: unknown) => void) => {
      socket.handlers.set(type, handler);
      return () => socket.handlers.delete(type);
    },
  }),
}));

const reminder = (id: string, title: string, readAt: string | null = null): Notification => ({
  id,
  type: 'deadline.reminder',
  payload: {
    cardId: `card-${id}`,
    boardId: 'b1',
    cardTitle: title,
    deadline: '2026-10-28T09:00:00.000Z',
  },
  readAt,
  createdAt: '2026-10-27T09:00:00.000Z',
});

beforeEach(() => {
  api.list.mockReset();
  api.markRead.mockReset();
  socket.handlers.clear();
});

describe('NotificationsBell', () => {
  it('shows the unread count and lists notifications newest first', async () => {
    api.list.mockResolvedValue({
      items: [
        reminder('n2', 'Newer'),
        reminder('n1', 'Older'),
        reminder('n0', 'Done', '2026-10-27T10:00:00.000Z'),
      ],
      nextCursor: null,
    });
    renderWithProviders(<NotificationsBell />);

    const bell = await screen.findByRole('button', { name: 'Notifications (2 unread)' });
    await userEvent.click(bell);

    const items = within(screen.getByRole('region', { name: 'Notifications list' })).getAllByRole(
      'listitem'
    );
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('"Newer" is due'),
      expect.stringContaining('"Older" is due'),
      expect.stringContaining('"Done" is due'),
    ]);
    expect(within(items[0]).getByRole('link')).toHaveAttribute('href', '/boards/b1');
    expect(within(items[2]).queryByRole('button', { name: 'Mark read' })).not.toBeInTheDocument();
  });

  it('marks a notification read and lowers the count', async () => {
    api.list.mockResolvedValue({ items: [reminder('n1', 'Ship it')], nextCursor: null });
    api.markRead.mockResolvedValue(reminder('n1', 'Ship it', '2026-10-27T11:00:00.000Z'));
    renderWithProviders(<NotificationsBell />);

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mark read' }));

    expect(api.markRead).toHaveBeenCalledWith('n1');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: 'Mark read' })).not.toBeInTheDocument();
  });

  it('adds a pushed notification.created without a reload', async () => {
    api.list.mockResolvedValue({ items: [], nextCursor: null });
    renderWithProviders(<NotificationsBell />);
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('No notifications')).toBeInTheDocument();

    const event: RealtimeEvent = {
      type: 'notification.created',
      boardId: 'b1',
      origin: 'user',
      occurredAt: '2026-10-27T09:00:00.000Z',
      payload: { recipientId: 'u1', notification: reminder('n9', 'Live one') },
    };
    act(() => socket.handlers.get('notification.created')?.(event));

    expect(
      await screen.findByRole('button', { name: 'Notifications (1 unread)' })
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Notifications list' })).getByText(
        /"Live one" is due/
      )
    ).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(1);
  });
});
