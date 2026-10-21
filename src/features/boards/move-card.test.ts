import { describe, it, expect } from 'vitest';
import type { BoardDetail, Card } from '../../api/schema';
import { dropPosition, moveCardInBoard } from './move-card';

function card(id: string, columnId: string, position: number): Card {
  return {
    id,
    boardId: 'b',
    columnId,
    title: id,
    position,
    labelIds: [],
    createdAt: '',
    updatedAt: '',
  };
}

const board: BoardDetail = {
  id: 'b',
  title: 'Board',
  myRole: 'MEMBER',
  createdAt: '',
  updatedAt: '',
  columns: [
    {
      id: 'todo',
      boardId: 'b',
      title: 'To Do',
      type: 'TODO',
      position: 0,
      cards: [card('a', 'todo', 0), card('b', 'todo', 1), card('c', 'todo', 2)],
    },
    {
      id: 'done',
      boardId: 'b',
      title: 'Done',
      type: 'DONE',
      position: 1,
      cards: [card('d', 'done', 0)],
    },
  ],
};

const ids = (b: BoardDetail, column: number) =>
  b.columns[column].cards.map((c) => `${c.id}${c.position}`);

describe('moveCardInBoard', () => {
  it('moves a card to another column and renumbers both columns', () => {
    const moved = moveCardInBoard(board, 'a', 'done', 0);
    expect(ids(moved, 0)).toEqual(['b0', 'c1']);
    expect(ids(moved, 1)).toEqual(['a0', 'd1']);
    expect(moved.columns[1].cards[0].columnId).toBe('done');
  });

  it('reorders within a column', () => {
    expect(ids(moveCardInBoard(board, 'a', 'todo', 2), 0)).toEqual(['b0', 'c1', 'a2']);
  });

  it('does not touch the original board (rollback uses it)', () => {
    moveCardInBoard(board, 'a', 'done', 0);
    expect(ids(board, 0)).toEqual(['a0', 'b1', 'c2']);
  });
});

describe('dropPosition', () => {
  it('drops in front of a card, ignoring the dragged card itself', () => {
    expect(dropPosition(board, 'a', 'todo', 'c')).toBe(1);
    expect(dropPosition(board, 'c', 'todo', 'a')).toBe(0);
  });

  it('drops at the end of a column', () => {
    expect(dropPosition(board, 'a', 'done', null)).toBe(1);
    expect(dropPosition(board, 'a', 'todo', null)).toBe(2);
  });
});
