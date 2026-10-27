import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { notificationsApi } from '../../api/endpoints';
import type { Notification, NotificationPage } from '../../api/schema';
import { useWebSocket } from '../../hooks/useWebSocket';

const notificationsKey = ['notifications'] as const;

interface ReminderPayload {
  cardId?: string;
  boardId?: string;
  cardTitle?: string;
  deadline?: string;
}

function describe(notification: Notification): string {
  const payload = (notification.payload ?? {}) as ReminderPayload;
  if (notification.type === 'deadline.reminder') {
    const due = payload.deadline ? new Date(payload.deadline).toLocaleString() : 'soon';
    return `"${payload.cardTitle ?? 'Card'}" is due ${due}`;
  }
  return notification.type;
}

/** Header bell: unread count, the user's notifications (newest first), mark read, live updates. */
export function NotificationsBell() {
  const queryClient = useQueryClient();
  const { on } = useWebSocket();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({ queryKey: notificationsKey, queryFn: () => notificationsApi.list() });
  const items = data?.items ?? [];
  const unread = items.filter((n) => !n.readAt).length;

  // The server pushes `notification.created` to the personal room `user:{id}`.
  useEffect(
    () =>
      on('notification.created', (event) => {
        const { notification } = event.payload as { notification: Notification };
        queryClient.setQueryData<NotificationPage>(notificationsKey, (page) =>
          page
            ? {
                ...page,
                items: [notification, ...page.items.filter((n) => n.id !== notification.id)],
              }
            : page
        );
        toast(describe(notification), { icon: '⏰' });
      }),
    [on, queryClient]
  );

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: (updated) =>
      queryClient.setQueryData<NotificationPage>(notificationsKey, (page) =>
        page ? { ...page, items: page.items.map((n) => (n.id === updated.id ? updated : n)) } : page
      ),
  });

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notifications list"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {items.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No notifications</p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {items.map((n) => {
                const boardId = (n.payload as ReminderPayload | undefined)?.boardId;
                return (
                  <li
                    key={n.id}
                    className={`p-3 text-sm ${n.readAt ? 'text-gray-500' : 'bg-primary-50'}`}
                  >
                    {boardId ? (
                      <Link
                        to={`/boards/${boardId}`}
                        onClick={() => setOpen(false)}
                        className="hover:underline"
                      >
                        {describe(n)}
                      </Link>
                    ) : (
                      <span>{describe(n)}</span>
                    )}
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                      <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString()}</time>
                      {!n.readAt && (
                        <button
                          type="button"
                          className="text-primary-700 hover:underline"
                          disabled={markRead.isPending}
                          onClick={() => markRead.mutate(n.id)}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
