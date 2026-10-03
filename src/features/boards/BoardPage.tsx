import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApi } from '../../api/endpoints';
import { useWebSocket } from '../../hooks/useWebSocket';

// Read-only board view with live refresh; drag-and-drop and editing are later tickets.
export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const queryClient = useQueryClient();
  const { joinBoard, leaveBoard, on } = useWebSocket();

  const { data: board, isLoading, isError } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => boardsApi.get(boardId as string),
    enabled: !!boardId,
  });

  useEffect(() => {
    if (!boardId) return;
    joinBoard(boardId);
    const refetch = () => void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    const offs = (['card.created', 'card.updated', 'card.moved', 'board.updated'] as const).map(
      (type) => on(type, refetch)
    );
    return () => {
      leaveBoard(boardId);
      offs.forEach((off) => off());
    };
  }, [boardId, joinBoard, leaveBoard, on, queryClient]);

  if (isLoading) return <p>Loading board...</p>;
  if (isError || !board) return <p role="alert">Board not found.</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{board.title}</h1>
      <div className="flex gap-4 overflow-x-auto">
        {board.columns.map((column) => (
          <section key={column.id} className="card p-3 w-72 shrink-0">
            <h2 className="font-semibold mb-2">{column.title}</h2>
            <ul className="space-y-2">
              {column.cards.map((card) => (
                <li key={card.id} className="rounded border border-gray-200 bg-white p-2 text-sm">
                  {card.title}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
