import type { BoardDetail } from '../../api/schema';

/**
 * Final index of a card dropped into `columnId` in front of `beforeCardId` (or at the end),
 * using the backend's `position` meaning: the index in the target column after the move.
 */
export function dropPosition(
  board: BoardDetail,
  cardId: string,
  columnId: string,
  beforeCardId: string | null
): number {
  const cards = board.columns.find((c) => c.id === columnId)?.cards ?? [];
  const others = cards.filter((c) => c.id !== cardId);
  if (!beforeCardId) return others.length;
  const index = others.findIndex((c) => c.id === beforeCardId);
  return index === -1 ? others.length : index;
}

/** Returns a copy of the board with the card moved, as the backend will store it (optimistic update). */
export function moveCardInBoard(
  board: BoardDetail,
  cardId: string,
  columnId: string,
  position: number
): BoardDetail {
  const card = board.columns.flatMap((c) => c.cards).find((c) => c.id === cardId);
  if (!card) return board;

  const columns = board.columns.map((column) => {
    let cards = column.cards.filter((c) => c.id !== cardId);
    if (column.id === columnId) {
      cards = [...cards.slice(0, position), { ...card, columnId }, ...cards.slice(position)];
    }
    return { ...column, cards: cards.map((c, index) => ({ ...c, position: index })) };
  });
  return { ...board, columns };
}
