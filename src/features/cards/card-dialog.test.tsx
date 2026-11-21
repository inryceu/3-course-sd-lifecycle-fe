import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CardDialog } from './CardDialog';
import { cardsApi, labelsApi, commentsApi, jiraApi } from '../../api/endpoints';
import { textOn } from './card-utils';

// A zone east of UTC: local midnight is the previous UTC day.
// TZ is set to Europe/Kyiv in vitest.config.ts (main process), see the assertion below.

vi.mock('../../api/endpoints', () => ({
  cardsApi: { update: vi.fn(), assign: vi.fn(), delete: vi.fn() },
  labelsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
  },
  commentsApi: { list: vi.fn(), create: vi.fn(), delete: vi.fn() },
  jiraApi: { connection: vi.fn() },
}));

vi.mock('../auth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' } })),
}));

const mock = (fn: unknown) => fn as Mock;

const mockCard = {
  id: 'c1',
  boardId: 'b1',
  columnId: 'col1',
  title: 'Test Card',
  description: 'Desc',
  position: 0,
  labelIds: ['l1'],
  deadline: '2026-03-10T00:00:00.000Z',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  jiraIssueKey: 'KAN-123',
};

const mockColumns = [
  { id: 'col1', boardId: 'b1', title: 'TODO', type: 'TODO', position: 0, cards: [] },
];
const mockMembers = [
  {
    boardId: 'b1',
    userId: 'u1',
    role: 'ADMIN',
    email: 'a@a.com',
    displayName: 'Admin User',
    invitedAt: '',
  },
];

const comment = (id: string, authorId: string, text = `text ${id}`) => ({
  id,
  cardId: 'c1',
  text,
  authorId,
  syncedToJira: false,
  createdAt: '2023-01-01T00:00:00Z',
});

function renderDialog(canEdit = true, props: { isAdmin?: boolean; onClose?: () => void } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = props.onClose ?? vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CardDialog
        card={mockCard as never}
        columns={mockColumns as never}
        members={mockMembers as never}
        canEdit={canEdit}
        isAdmin={props.isAdmin}
        onMove={vi.fn()}
        onClose={onClose}
        onChanged={vi.fn()}
      />
    </QueryClientProvider>
  );
  return { ...view, onClose };
}

describe('CardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock(jiraApi.connection).mockResolvedValue({ siteUrl: 'https://test.atlassian.net/' });
    mock(labelsApi.list).mockResolvedValue([
      { id: 'l1', boardId: 'b1', name: 'Bug', color: '#ff0000' },
      { id: 'l2', boardId: 'b1', name: 'Chore', color: '#ffff00' },
    ]);
    mock(commentsApi.list).mockResolvedValue({ items: [comment('com1', 'u1', 'Hello')] });
    mock(cardsApi.update).mockResolvedValue({});
  });

  it('renders card details and correct Jira link (trailing slash tolerated)', async () => {
    renderDialog();
    expect(screen.getByDisplayValue('Test Card')).toBeInTheDocument();

    await waitFor(() => {
      const jiraLink = screen.getByRole('link', { name: /KAN-123/ });
      expect(jiraLink).toHaveAttribute('href', 'https://test.atlassian.net/browse/KAN-123');
    });
  });

  it('allows editing for members/admins and calls API', async () => {
    const user = userEvent.setup();
    renderDialog();

    const titleInput = screen.getByDisplayValue('Test Card');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Card');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(cardsApi.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ title: 'Updated Card' })
    );
  });

  it('read-only for viewers: no edit controls at all', async () => {
    renderDialog(false);
    expect(screen.getByDisplayValue('Test Card')).toBeDisabled();
    expect(screen.getByDisplayValue('Desc')).toBeDisabled();
    expect(screen.getByLabelText('Assignee')).toBeDisabled();
    expect(screen.getByLabelText('Deadline')).toBeDisabled();
    expect(screen.getByLabelText('Column')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete card/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add comment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ add/i })).not.toBeInTheDocument();
    await screen.findByText('Hello');
    expect(screen.queryByPlaceholderText('Write a comment...')).not.toBeInTheDocument();
  });

  describe('deadline (date-only, east of UTC)', () => {
    it('shows the stored UTC date', () => {
      expect(new Date(2026, 2, 10).getTimezoneOffset()).toBe(-120); // the TZ stub is effective
      renderDialog();
      expect(screen.getByLabelText('Deadline')).toHaveValue('2026-03-10');
    });

    it('does not send the deadline when only the title changed', async () => {
      const user = userEvent.setup();
      renderDialog();
      const titleInput = screen.getByDisplayValue('Test Card');
      await user.type(titleInput, '!');
      await user.click(screen.getByRole('button', { name: /save/i }));
      const [, body] = mock(cardsApi.update).mock.calls[0] as [string, object];
      expect(body).not.toHaveProperty('deadline');
    });

    it('sends the picked date as UTC midnight', async () => {
      const user = userEvent.setup();
      renderDialog();
      const input = screen.getByLabelText('Deadline');
      await user.clear(input);
      await user.type(input, '2026-03-11');
      await user.click(screen.getByRole('button', { name: /save/i }));
      expect(cardsApi.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ deadline: '2026-03-11T00:00:00.000Z' })
      );
    });
  });

  describe('errors never lose input', () => {
    it('keeps the dialog open and shows an alert when save fails', async () => {
      mock(cardsApi.update).mockRejectedValue(new Error('Card was deleted'));
      const user = userEvent.setup();
      const { onClose } = renderDialog();
      const titleInput = screen.getByDisplayValue('Test Card');
      await user.type(titleInput, ' edited');
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Card was deleted');
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue('Test Card edited')).toBeInTheDocument();
    });

    it('closes after a successful save', async () => {
      const user = userEvent.setup();
      const { onClose } = renderDialog();
      await user.type(screen.getByDisplayValue('Test Card'), '!');
      await user.click(screen.getByRole('button', { name: /save/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('keeps the typed comment and shows an alert when create fails', async () => {
      mock(commentsApi.create).mockRejectedValue(new Error('Forbidden'));
      const user = userEvent.setup();
      renderDialog();
      const box = await screen.findByPlaceholderText('Write a comment...');
      await user.type(box, 'precious text');
      await user.click(screen.getByRole('button', { name: /add comment/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
      expect(box).toHaveValue('precious text');
      expect(screen.queryByText('precious text', { selector: 'p' })).not.toBeInTheDocument();
    });

    it('shows an alert when card delete fails', async () => {
      mock(cardsApi.delete).mockRejectedValue(new Error('Nope'));
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('button', { name: 'Delete card' }));
      await user.click(screen.getByRole('button', { name: /confirm delete card/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Nope');
    });

    it('shows an alert when assign fails', async () => {
      mock(cardsApi.assign).mockRejectedValue(new Error('Not a member'));
      const user = userEvent.setup();
      renderDialog();
      await user.selectOptions(screen.getByLabelText('Assignee'), 'u1');
      expect(await screen.findByRole('alert')).toHaveTextContent('Not a member');
    });
  });

  describe('comments', () => {
    it('adds a comment', async () => {
      mock(commentsApi.create).mockResolvedValue(comment('new1', 'u1', 'New comment'));
      const user = userEvent.setup();
      renderDialog();
      const box = await screen.findByPlaceholderText('Write a comment...');
      await user.type(box, 'New comment');
      await user.click(screen.getByRole('button', { name: /add comment/i }));
      expect(commentsApi.create).toHaveBeenCalledWith('c1', 'New comment');
      await waitFor(() => expect(box).toHaveValue(''));
    });

    it('pages with the returned cursor and appends page 2 once', async () => {
      mock(commentsApi.list).mockImplementation((_id: string, cursor?: string) =>
        Promise.resolve(
          cursor === 'cur1'
            ? { items: [comment('p2', 'u1', 'second page')], nextCursor: null }
            : { items: [comment('p1', 'u1', 'first page')], nextCursor: 'cur1' }
        )
      );
      const user = userEvent.setup();
      renderDialog();
      await screen.findByText('first page');
      await user.click(screen.getByRole('button', { name: /load more comments/i }));
      await screen.findByText('second page');
      expect(commentsApi.list).toHaveBeenCalledWith('c1', 'cur1');
      expect(screen.getAllByText('second page')).toHaveLength(1);
      expect(screen.queryByRole('button', { name: /load more comments/i })).not.toBeInTheDocument();
    });

    it('keeps a new comment visible while older pages are unloaded', async () => {
      mock(commentsApi.list).mockResolvedValue({
        items: [comment('p1', 'u1', 'first page')],
        nextCursor: 'cur1',
      });
      mock(commentsApi.create).mockResolvedValue(comment('new1', 'u1', 'fresh one'));
      const user = userEvent.setup();
      renderDialog();
      await user.type(await screen.findByPlaceholderText('Write a comment...'), 'fresh one');
      await user.click(screen.getByRole('button', { name: /add comment/i }));
      await screen.findByText('fresh one');
      // the refetch triggered by invalidation does not return it; it must stay
      await waitFor(() => expect(commentsApi.list).toHaveBeenCalledTimes(2));
      expect(screen.getByText('fresh one')).toBeInTheDocument();
    });

    it('Member sees Delete only on own comments; Admin on all', async () => {
      mock(commentsApi.list).mockResolvedValue({
        items: [comment('a', 'u1', 'mine'), comment('b', 'u2', 'theirs')],
      });
      const { unmount } = renderDialog(true, { isAdmin: false });
      await screen.findByText('theirs');
      expect(screen.getAllByRole('button', { name: /delete comment by/i })).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Delete comment by You' })).toBeVisible();
      unmount();

      renderDialog(true, { isAdmin: true });
      await screen.findByText('theirs');
      expect(screen.getAllByRole('button', { name: /delete comment by/i })).toHaveLength(2);
    });

    it('restores a comment and alerts when delete fails', async () => {
      mock(commentsApi.delete).mockRejectedValue(new Error('Forbidden'));
      const user = userEvent.setup();
      renderDialog();
      await screen.findByText('Hello');
      await user.click(screen.getByRole('button', { name: /delete comment by you/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
  });

  describe('labels', () => {
    it('creates a label from the popover and attaches it', async () => {
      mock(labelsApi.create).mockResolvedValue({
        id: 'l3',
        boardId: 'b1',
        name: 'New',
        color: '#3498db',
      });
      mock(labelsApi.attach).mockResolvedValue({});
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('button', { name: /\+ add/i }));
      await user.type(screen.getByLabelText('New label name'), 'New');
      await user.click(screen.getByRole('button', { name: 'Create' }));
      await waitFor(() =>
        expect(labelsApi.create).toHaveBeenCalledWith('b1', { name: 'New', color: '#3498db' })
      );
      await waitFor(() => expect(labelsApi.attach).toHaveBeenCalledWith('c1', 'l3'));
    });

    it('renames and deletes a label', async () => {
      mock(labelsApi.update).mockResolvedValue({});
      mock(labelsApi.delete).mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('button', { name: /\+ add/i }));
      await user.click(screen.getByRole('button', { name: 'Rename label Chore' }));
      const name = screen.getByLabelText('Label name');
      await user.clear(name);
      await user.type(name, 'Task');
      await user.click(within(name.closest('form')!).getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(labelsApi.update).toHaveBeenCalledWith(
          'l2',
          expect.objectContaining({ name: 'Task' })
        )
      );

      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      await user.click(screen.getByRole('button', { name: /confirm delete/i }));
      await waitFor(() => expect(labelsApi.delete).toHaveBeenCalledWith('l1'));
    });

    it('shows an alert when attach fails', async () => {
      mock(labelsApi.attach).mockRejectedValue(new Error('Boom'));
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('button', { name: /\+ add/i }));
      await user.click(screen.getByRole('button', { name: 'Chore' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
    });

    it('chooses a readable text color', () => {
      expect(textOn('#ffff00')).toBe('#000000');
      expect(textOn('#000080')).toBe('#ffffff');
      expect(textOn('#3498db')).toBe('#000000');
    });
  });

  describe('dialog accessibility', () => {
    it('focuses the title on open', () => {
      renderDialog();
      expect(screen.getByLabelText('Title')).toHaveFocus();
    });

    it('focuses the dialog itself for viewers', () => {
      renderDialog(false);
      expect(screen.getByRole('dialog')).toHaveFocus();
    });

    it('returns focus to the opener on close', () => {
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();
      const { unmount } = renderDialog();
      expect(opener).not.toHaveFocus();
      unmount();
      expect(opener).toHaveFocus();
      opener.remove();
    });

    it('Esc closes the label popover first, then the dialog', async () => {
      const user = userEvent.setup();
      const { onClose } = renderDialog();
      const toggle = screen.getByRole('button', { name: /\+ add/i });
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{Escape}');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(onClose).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('traps Tab inside the dialog', async () => {
      const user = userEvent.setup();
      renderDialog();
      await screen.findByRole('link', { name: /KAN-123/ });
      const dialog = screen.getByRole('dialog');
      const closeBtn = screen.getByRole('button', { name: 'Close' });
      const saveBtn = screen.getByRole('button', { name: 'Save' });
      saveBtn.focus();
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(saveBtn).not.toHaveFocus();
      await user.tab({ shift: true });
      expect(saveBtn).toHaveFocus();
      expect(closeBtn).toBeInTheDocument();
    });

    it('backdrop click closes a clean dialog but not one with unsaved edits', async () => {
      const user = userEvent.setup();
      const { onClose, container } = renderDialog();
      const backdrop = container.firstElementChild as HTMLElement;
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
      await user.type(screen.getByLabelText('Title'), '!');
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
