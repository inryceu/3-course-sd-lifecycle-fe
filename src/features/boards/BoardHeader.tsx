import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { boardsApi } from '../../api/endpoints';
import type { BoardDetail } from '../../api/schema';
import { ConfirmButton } from '../../components/ConfirmButton';
import { clsx } from 'clsx';

export function BoardHeader({
  board,
  isConnected = false,
}: {
  board: BoardDetail;
  isConnected?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = board.myRole === 'ADMIN';
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? '');

  const update = useMutation({
    mutationFn: () =>
      boardsApi.update(board.id, { title: title.trim(), description: description.trim() || null }),
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['board', board.id] });
      void queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });

  const remove = useMutation({
    mutationFn: () => boardsApi.delete(board.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['boards'] });
      navigate('/boards');
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim()) update.mutate();
  };

  if (editing) {
    return (
      <form
        onSubmit={onSubmit}
        className="card p-4 mb-4 space-y-2 max-w-xl"
        aria-label="Board settings"
      >
        <label className="label" htmlFor="board-title">
          Title
        </label>
        <input
          id="board-title"
          className="input"
          maxLength={255}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="label" htmlFor="board-description">
          Description
        </label>
        <textarea
          id="board-description"
          className="input"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="btn-primary text-sm"
            disabled={!title.trim() || update.isPending}
          >
            Save
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{board.title}</h1>
          <div
            title={isConnected ? 'Connected to live updates' : 'Disconnected, reconnecting...'}
            className={clsx(
              'h-2.5 w-2.5 rounded-full mt-1.5',
              isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
            )}
            aria-label="Connection status"
          />
        </div>
        {board.description && <p className="text-gray-600 mt-1">{board.description}</p>}
        <p className="text-xs text-gray-500 mt-1">Your role: {board.myRole}</p>
      </div>
      {isAdmin && (
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setTitle(board.title);
              setDescription(board.description ?? '');
              setEditing(true);
            }}
          >
            Edit board
          </button>
          <ConfirmButton
            label="Delete board"
            onConfirm={() => remove.mutate()}
            disabled={remove.isPending}
          />
        </div>
      )}
    </div>
  );
}
