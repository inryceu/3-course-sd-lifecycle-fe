import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CardDialog } from './CardDialog';
import { cardsApi, labelsApi, commentsApi, jiraApi } from '../../api/endpoints';

vi.mock('../../api/endpoints', () => ({
  cardsApi: { update: vi.fn(), assign: vi.fn(), delete: vi.fn() },
  labelsApi: { list: vi.fn(), attach: vi.fn(), detach: vi.fn() },
  commentsApi: { list: vi.fn(), create: vi.fn(), delete: vi.fn() },
  jiraApi: { connection: vi.fn() },
}));

vi.mock('../auth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' } })),
}));

const mockCard = {
  id: 'c1',
  boardId: 'b1',
  columnId: 'col1',
  title: 'Test Card',
  description: 'Desc',
  position: 0,
  labelIds: ['l1'],
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

function renderDialog(canEdit = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CardDialog
        card={mockCard as any}
        columns={mockColumns as any}
        members={mockMembers as any}
        canEdit={canEdit}
        onMove={vi.fn()}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe('CardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (jiraApi.connection as any).mockResolvedValue({ siteUrl: 'https://test.atlassian.net' });
    (labelsApi.list as any).mockResolvedValue([{ id: 'l1', name: 'Bug', color: '#f00' }]);
    (commentsApi.list as any).mockResolvedValue({
      items: [{ id: 'com1', text: 'Hello', authorId: 'u1', createdAt: '2023-01-01T00:00:00Z' }],
    });
  });

  it('renders card details and correct Jira link', async () => {
    renderDialog();
    expect(screen.getByDisplayValue('Test Card')).toBeInTheDocument();

    await waitFor(() => {
      const jiraLink = screen.getByText('🔗 KAN-123');
      expect(jiraLink).toHaveAttribute('href', 'https://test.atlassian.net/browse/KAN-123');
    });
  });

  it('allows editing for members/admins and calls API', async () => {
    const user = userEvent.setup();
    renderDialog();

    const titleInput = screen.getByDisplayValue('Test Card');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Card');

    const saveBtn = screen.getByRole('button', { name: /save/i });
    await user.click(saveBtn);

    expect(cardsApi.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ title: 'Updated Card' })
    );
  });

  it('disables inputs and hides action buttons for viewers', () => {
    renderDialog(false);
    expect(screen.getByDisplayValue('Test Card')).toBeDisabled();
    expect(screen.getByDisplayValue('Desc')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add comment/i })).not.toBeInTheDocument();
  });

  it('adds a comment', async () => {
    const user = userEvent.setup();
    renderDialog();

    const commentInput = await screen.findByPlaceholderText('Write a comment...');
    await user.type(commentInput, 'New comment');

    const addBtn = screen.getByRole('button', { name: /add comment/i });
    await user.click(addBtn);

    expect(commentsApi.create).toHaveBeenCalledWith('c1', 'New comment');
  });
});
