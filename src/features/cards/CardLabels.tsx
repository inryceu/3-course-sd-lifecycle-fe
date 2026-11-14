import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labelsApi } from '../../api/endpoints';
import type { Card, BoardDetail } from '../../api/schema';
import { clsx } from 'clsx';

export function CardLabels({ card, canEdit }: { card: Card; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const boardQueryKey = ['board', card.boardId];

  const { data: boardLabels = [] } = useQuery({
    queryKey: ['labels', card.boardId],
    queryFn: () => labelsApi.list(card.boardId),
  });

  const attachedLabels = boardLabels.filter((l) => card.labelIds.includes(l.id));

  const attach = useMutation({
    mutationFn: (labelId: string) => labelsApi.attach(card.id, labelId),
    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey });
      const previous = queryClient.getQueryData<BoardDetail>(boardQueryKey);
      if (previous) {
        queryClient.setQueryData<BoardDetail>(boardQueryKey, {
          ...previous,
          columns: previous.columns.map((col) =>
            col.id === card.columnId
              ? {
                  ...col,
                  cards: col.cards.map((c) =>
                    c.id === card.id ? { ...c, labelIds: [...c.labelIds, labelId] } : c
                  ),
                }
              : col
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _var, context) => {
      if (context?.previous) queryClient.setQueryData(boardQueryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardQueryKey }),
  });

  const detach = useMutation({
    mutationFn: (labelId: string) => labelsApi.detach(card.id, labelId),
    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey });
      const previous = queryClient.getQueryData<BoardDetail>(boardQueryKey);
      if (previous) {
        queryClient.setQueryData<BoardDetail>(boardQueryKey, {
          ...previous,
          columns: previous.columns.map((col) =>
            col.id === card.columnId
              ? {
                  ...col,
                  cards: col.cards.map((c) =>
                    c.id === card.id
                      ? { ...c, labelIds: c.labelIds.filter((id) => id !== labelId) }
                      : c
                  ),
                }
              : col
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _var, context) => {
      if (context?.previous) queryClient.setQueryData(boardQueryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardQueryKey }),
  });

  const toggleLabel = (labelId: string) => {
    if (!canEdit) return;
    if (card.labelIds.includes(labelId)) detach.mutate(labelId);
    else attach.mutate(labelId);
  };

  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold mb-2">Labels</h3>
      <div className="flex flex-wrap gap-2 items-center">
        {attachedLabels.map((label) => (
          <span
            key={label.id}
            className="px-2 py-1 rounded text-xs font-medium text-white"
            style={{ backgroundColor: label.color }}
          >
            {label.name}
          </span>
        ))}
        {canEdit && (
          <div className="relative">
            <button
              type="button"
              className="btn-secondary text-xs py-1"
              onClick={() => setIsOpen(!isOpen)}
            >
              + Add
            </button>
            {isOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border shadow-lg rounded p-2 z-10 w-48">
                {boardLabels.length === 0 ? (
                  <p className="text-xs text-gray-500">No labels on this board.</p>
                ) : (
                  boardLabels.map((label) => {
                    const isAttached = card.labelIds.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        className={clsx(
                          'w-full text-left px-2 py-1 text-xs rounded mb-1 last:mb-0 hover:opacity-80 transition-opacity',
                          isAttached && 'ring-2 ring-blue-500 ring-offset-1'
                        )}
                        style={{ backgroundColor: label.color, color: 'white' }}
                        onClick={() => toggleLabel(label.id)}
                      >
                        {label.name}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
