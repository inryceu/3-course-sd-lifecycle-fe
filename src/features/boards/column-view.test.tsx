import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ColumnType } from '../../api/schema';
import { ColumnView } from './ColumnView';

vi.mock('../../api/endpoints', () => ({
  columnsApi: { update: vi.fn(), reorder: vi.fn(), delete: vi.fn() },
  cardsApi: { create: vi.fn() },
}));

const HOUR = 1000 * 60 * 60;

function card(id: string, title: string, deadline?: string) {
  return {
    id,
    boardId: 'b1',
    columnId: 'col1',
    title,
    position: 0,
    labelIds: [],
    createdAt: '',
    updatedAt: '',
    deadline,
  };
}

function renderColumn(cards: ReturnType<typeof card>[], type: ColumnType = 'TODO') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ColumnView
        column={{ id: 'col1', boardId: 'b1', title: 'Column', type, position: 0, cards }}
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
}

afterEach(() => {
  vi.useRealTimers();
});

describe('ColumnView - Deadline Badges', () => {
  it('shows Overdue and Due soon badges based on deadline', () => {
    const now = Date.now();
    renderColumn([
      card('c1', 'Overdue Card', new Date(now - HOUR).toISOString()),
      card('c2', 'Soon Card', new Date(now + 10 * HOUR).toISOString()),
    ]);

    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Due soon')).toBeInTheDocument();
  });

  it('shows no badge without a deadline or when it is more than 24 hours away', () => {
    const now = Date.now();
    renderColumn([
      card('c1', 'No deadline'),
      card('c2', 'Far away', new Date(now + 25 * HOUR).toISOString()),
    ]);

    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    expect(screen.queryByText('Due soon')).not.toBeInTheDocument();
  });

  it('shows no deadline badge for cards in a DONE column', () => {
    const now = Date.now();
    renderColumn(
      [
        card('c1', 'Finished late', new Date(now - 48 * HOUR).toISOString()),
        card('c2', 'Finished early', new Date(now + HOUR).toISOString()),
      ],
      'DONE'
    );

    expect(screen.getByText('Finished late')).toBeInTheDocument();
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    expect(screen.queryByText('Due soon')).not.toBeInTheDocument();
  });

  it('recomputes the badge as time passes without another render from outside', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-21T10:00:00Z'));
    renderColumn([card('c1', 'Ticking', '2026-11-21T10:00:30Z')]);
    expect(screen.getByText('Due soon')).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(60_000));

    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.queryByText('Due soon')).not.toBeInTheDocument();
  });

  it('lets the deadline row wrap in a narrow column', () => {
    renderColumn([card('c1', 'Soon', new Date(Date.now() + HOUR).toISOString())]);
    expect(screen.getByText('Due soon').parentElement).toHaveClass('flex-wrap');
  });
});
