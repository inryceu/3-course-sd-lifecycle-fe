import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApi } from '../../api/endpoints';

export function BoardsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  const {
    data: boards,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['boards'],
    queryFn: () => boardsApi.list(),
  });

  const create = useMutation({
    mutationFn: (newTitle: string) => boardsApi.create({ title: newTitle }),
    onSuccess: (board) => {
      void queryClient.invalidateQueries({ queryKey: ['boards'] });
      navigate(`/boards/${board.id}`);
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim()) create.mutate(title.trim());
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Boards</h1>

      <form onSubmit={onSubmit} className="flex gap-2 mb-6 max-w-lg">
        <label htmlFor="new-board-title" className="sr-only">
          New board title
        </label>
        <input
          id="new-board-title"
          className="input"
          placeholder="New board title"
          maxLength={255}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="submit"
          className="btn-primary whitespace-nowrap"
          disabled={!title.trim() || create.isPending}
        >
          Create board
        </button>
      </form>

      {isLoading && <p>Loading boards...</p>}
      {isError && <p role="alert">Could not load boards.</p>}
      {boards && boards.length === 0 && <p className="text-gray-600">No boards yet.</p>}
      <ul className="space-y-2">
        {boards?.map((board) => (
          <li key={board.id} className="card p-4">
            <Link to={`/boards/${board.id}`} className="font-medium text-primary-600">
              {board.title}
            </Link>
            <span className="ml-2 text-xs text-gray-500">{board.myRole}</span>
            {board.description && <p className="text-sm text-gray-600 mt-1">{board.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
