import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApi, cardsApi, columnsApi } from '../../api/endpoints';
import type { BoardDetail } from '../../api/schema';
import { useWebSocket } from '../../hooks/useWebSocket';
import { CardDialog } from '../cards';
import { BoardHeader } from './BoardHeader';
import { ColumnView } from './ColumnView';
import { dropPosition, moveCardInBoard } from './move-card';

interface MoveInput {
  cardId: string;
  columnId: string;
  position: number;
}

export function BoardPage() {
  const { boardId = '' } = useParams<{ boardId: string }>();
  const queryKey = ['board', boardId];
  const queryClient = useQueryClient();
  const { joinBoard, leaveBoard, on } = useWebSocket();
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [newColumn, setNewColumn] = useState('');

  const {
    data: board,
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => boardsApi.get(boardId),
    enabled: !!boardId,
  });

  const refresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: ['board', boardId] }),
    [queryClient, boardId]
  );

  useEffect(() => {
    if (!boardId) return;
    joinBoard(boardId);
    const offs = (['card.created', 'card.updated', 'card.moved', 'board.updated'] as const).map(
      (type) => on(type, refresh)
    );
    return () => {
      leaveBoard(boardId);
      offs.forEach((off) => off());
    };
  }, [boardId, joinBoard, leaveBoard, on, refresh]);

  const move = useMutation({
    mutationFn: ({ cardId, columnId, position }: MoveInput) =>
      cardsApi.move(cardId, { columnId, position }),
    onMutate: async ({ cardId, columnId, position }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BoardDetail>(queryKey);
      if (previous) {
        queryClient.setQueryData(queryKey, moveCardInBoard(previous, cardId, columnId, position));
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: refresh,
  });

  const addColumn = useMutation({
    mutationFn: (title: string) => columnsApi.create(boardId, { title }),
    onSuccess: () => {
      setNewColumn('');
      refresh();
    },
  });

  if (isLoading) return <p>Loading board...</p>;
  if (isError || !board) return <p role="alert">Board not found.</p>;

  const canEditStructure = board.myRole === 'ADMIN';
  const canEditCards = board.myRole !== 'VIEWER';
  const openCard = board.columns.flatMap((c) => c.cards).find((c) => c.id === openCardId);

  const onDrop = (columnId: string, beforeCardId: string | null) => {
    const cardId = draggingCardId;
    setDraggingCardId(null);
    if (!cardId || !canEditCards) return;
    const position = dropPosition(board, cardId, columnId, beforeCardId);
    const card = board.columns.flatMap((c) => c.cards).find((c) => c.id === cardId);
    if (card && card.columnId === columnId && card.position === position) return;
    move.mutate({ cardId, columnId, position });
  };

  const onAddColumn = (event: FormEvent) => {
    event.preventDefault();
    if (newColumn.trim()) addColumn.mutate(newColumn.trim());
  };

  return (
    <div>
      <BoardHeader key={board.updatedAt} board={board} />
      <div className="flex gap-4 overflow-x-auto pb-4 items-start scrollbar-thin">
        {board.columns.map((column, index) => (
          <ColumnView
            key={column.id}
            column={column}
            index={index}
            columnCount={board.columns.length}
            canEditStructure={canEditStructure}
            canEditCards={canEditCards}
            draggingCardId={draggingCardId}
            onDragStart={setDraggingCardId}
            onDrop={onDrop}
            onOpenCard={(card) => setOpenCardId(card.id)}
            onChanged={refresh}
          />
        ))}
        {canEditStructure && (
          <form onSubmit={onAddColumn} className="card p-3 w-64 shrink-0 space-y-2">
            <input
              aria-label="New column title"
              className="input text-sm"
              placeholder="New column"
              maxLength={255}
              value={newColumn}
              onChange={(e) => setNewColumn(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary text-sm w-full"
              disabled={!newColumn.trim() || addColumn.isPending}
            >
              Add column
            </button>
          </form>
        )}
      </div>

      {openCard && (
        <CardDialog
          key={openCard.id + openCard.updatedAt}
          card={openCard}
          columns={board.columns}
          canEdit={canEditCards}
          onMove={(cardId, columnId) =>
            move.mutate({ cardId, columnId, position: dropPosition(board, cardId, columnId, null) })
          }
          onClose={() => setOpenCardId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
