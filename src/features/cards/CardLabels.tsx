import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labelsApi } from '../../api/endpoints';
import type { Card, BoardDetail } from '../../api/schema';
import { ConfirmButton } from '../../components/ConfirmButton';
import { clsx } from 'clsx';
import { errorMessage, textOn } from './card-utils';

const DEFAULT_COLOR = '#3498db';

export function CardLabels({ card, canEdit }: { card: Card; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);

  const boardQueryKey = ['board', card.boardId];
  const labelsKey = ['labels', card.boardId];

  const { data: boardLabels = [] } = useQuery({
    queryKey: labelsKey,
    queryFn: () => labelsApi.list(card.boardId),
  });

  const attachedLabels = boardLabels.filter((l) => card.labelIds.includes(l.id));

  const setCardLabels = (change: (ids: string[]) => string[]) => {
    const previous = queryClient.getQueryData<BoardDetail>(boardQueryKey);
    if (previous) {
      queryClient.setQueryData<BoardDetail>(boardQueryKey, {
        ...previous,
        columns: previous.columns.map((col) =>
          col.id === card.columnId
            ? {
                ...col,
                cards: col.cards.map((c) =>
                  c.id === card.id ? { ...c, labelIds: change(c.labelIds) } : c
                ),
              }
            : col
        ),
      });
    }
    return previous;
  };

  const attach = useMutation({
    mutationFn: (labelId: string) => labelsApi.attach(card.id, labelId),
    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey });
      return { previous: setCardLabels((ids) => [...ids, labelId]) };
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
      return { previous: setCardLabels((ids) => ids.filter((id) => id !== labelId)) };
    },
    onError: (_err, _var, context) => {
      if (context?.previous) queryClient.setQueryData(boardQueryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardQueryKey }),
  });

  const create = useMutation({
    mutationFn: () => labelsApi.create(card.boardId, { name: newName.trim(), color: newColor }),
    onSuccess: (label) => {
      setNewName('');
      attach.mutate(label.id);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: labelsKey }),
  });

  const rename = useMutation({
    mutationFn: (labelId: string) =>
      labelsApi.update(labelId, { name: editName.trim(), color: editColor }),
    onSuccess: () => setEditingId(null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: labelsKey }),
  });

  const destroy = useMutation({
    mutationFn: (labelId: string) => labelsApi.delete(labelId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: labelsKey });
      void queryClient.invalidateQueries({ queryKey: boardQueryKey });
    },
  });

  const failed = [create, rename, destroy, attach, detach].find((m) => m.isError);

  const toggleLabel = (labelId: string) => {
    if (!canEdit) return;
    if (card.labelIds.includes(labelId)) detach.mutate(labelId);
    else attach.mutate(labelId);
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (newName.trim()) create.mutate();
  };

  const onRename = (e: FormEvent, labelId: string) => {
    e.preventDefault();
    if (editName.trim()) rename.mutate(labelId);
  };

  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold mb-2">Labels</h3>
      <div className="flex flex-wrap gap-2 items-center">
        {attachedLabels.map((label) => (
          <span
            key={label.id}
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: label.color, color: textOn(label.color) }}
          >
            {label.name}
          </span>
        ))}
        {canEdit && (
          <div
            className="relative"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && isOpen) {
                e.stopPropagation();
                setIsOpen(false);
              }
            }}
          >
            <button
              type="button"
              className="btn-secondary text-xs py-1"
              aria-expanded={isOpen}
              aria-controls="card-labels-popover"
              onClick={() => setIsOpen(!isOpen)}
            >
              + Add
            </button>
            {isOpen && (
              <div
                id="card-labels-popover"
                className="absolute top-full left-0 mt-1 bg-white border shadow-lg rounded p-2 z-10 w-64"
              >
                {boardLabels.length === 0 && (
                  <p className="text-xs text-gray-500 mb-2">No labels on this board.</p>
                )}
                {boardLabels.map((label) => {
                  const isAttached = card.labelIds.includes(label.id);
                  if (editingId === label.id) {
                    return (
                      <form
                        key={label.id}
                        onSubmit={(e) => onRename(e, label.id)}
                        className="flex gap-1 mb-1 items-center"
                      >
                        <input
                          className="input text-xs py-1 min-w-0 flex-1"
                          aria-label="Label name"
                          maxLength={50}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                        <input
                          type="color"
                          aria-label="Label color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                        />
                        <button type="submit" className="btn-primary text-xs py-1">
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs py-1"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </form>
                    );
                  }
                  return (
                    <div key={label.id} className="flex gap-1 mb-1 items-center">
                      <button
                        type="button"
                        aria-pressed={isAttached}
                        className={clsx(
                          'flex-1 min-w-0 text-left px-2 py-1 text-xs rounded hover:opacity-80 transition-opacity',
                          isAttached && 'ring-2 ring-blue-500 ring-offset-1'
                        )}
                        style={{ backgroundColor: label.color, color: textOn(label.color) }}
                        onClick={() => toggleLabel(label.id)}
                      >
                        {label.name}
                      </button>
                      <button
                        type="button"
                        className="text-xs underline"
                        aria-label={`Rename label ${label.name}`}
                        onClick={() => {
                          setEditingId(label.id);
                          setEditName(label.name);
                          setEditColor(label.color);
                        }}
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        label="Delete"
                        className="text-xs underline text-red-600"
                        onConfirm={() => destroy.mutate(label.id)}
                      />
                    </div>
                  );
                })}
                <form onSubmit={onCreate} className="flex gap-1 mt-2 items-center border-t pt-2">
                  <input
                    className="input text-xs py-1 min-w-0 flex-1"
                    placeholder="New label"
                    aria-label="New label name"
                    maxLength={50}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <input
                    type="color"
                    aria-label="New label color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn-primary text-xs py-1"
                    disabled={!newName.trim() || create.isPending}
                  >
                    Create
                  </button>
                </form>
                {failed && (
                  <p role="alert" className="text-xs text-red-600 mt-2">
                    {errorMessage(failed.error)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
