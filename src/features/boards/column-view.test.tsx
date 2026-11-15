import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ColumnView } from './ColumnView';

vi.mock('../../api/endpoints', () => ({
  columnsApi: { update: vi.fn(), reorder: vi.fn(), delete: vi.fn() },
  cardsApi: { create: vi.fn() },
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('ColumnView - Deadline Badges', () => {
  it('shows Overdue and Due soon badges based on deadline', () => {
    const now = Date.now();
    const overdueTime = new Date(now - 1000 * 60 * 60).toISOString();
    const dueSoonTime = new Date(now + 1000 * 60 * 60 * 10).toISOString();

    const mockColumn = {
      id: 'col1',
      boardId: 'b1',
      title: 'TODO',
      type: 'TODO' as const,
      position: 0,
      cards: [
        {
          id: 'c1',
          boardId: 'b1',
          columnId: 'col1',
          title: 'Overdue Card',
          position: 0,
          labelIds: [],
          createdAt: '',
          updatedAt: '',
          deadline: overdueTime,
        },
        {
          id: 'c2',
          boardId: 'b1',
          columnId: 'col1',
          title: 'Soon Card',
          position: 1,
          labelIds: [],
          createdAt: '',
          updatedAt: '',
          deadline: dueSoonTime,
        },
      ],
    };

    render(
      <QueryClientProvider client={queryClient}>
        <ColumnView
          column={mockColumn}
          index={0}
          columnCount={1}
          canEditStructure={true}
          canEditCards={true}
          draggingCardId={null}
          onDragStart={vi.fn()}
          onDrop={vi.fn()}
          members={[]}
          onOpenCard={vi.fn()}
          onChanged={vi.fn()}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Due soon')).toBeInTheDocument();
  });
});
