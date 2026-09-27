import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { boardsApi } from '../../api/endpoints';

export function BoardsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardJiraKey, setNewBoardJiraKey] = useState('');
  const [createError, setCreateError] = useState('');

  const { data: boards, isLoading, error } = useQuery({
    queryKey: ['boards'],
    queryFn: boardsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: boardsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      setShowCreateModal(false);
      setNewBoardTitle('');
      setNewBoardJiraKey('');
      setCreateError('');
    },
    onError: (err: any) => {
      setCreateError(err.message || 'Failed to create board');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardTitle.trim()) return;
    createMutation.mutate({ title: newBoardTitle.trim(), jiraProjectKey: newBoardJiraKey.trim() || undefined });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading boards...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600">Failed to load boards</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Boards</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Board
        </button>
      </div>

      {boards && boards.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards.map((board) => (
            <Link key={board.id} to={`/boards/${board.id}`} className="card p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{board.title}</h3>
              {board.jiraProjectKey && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Jira: {board.jiraProjectKey}
                </span>
              )}
              <p className="mt-4 text-sm text-gray-500">
                {board.columns?.length || 0} columns
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No boards yet</h3>
          <p className="mt-1 text-gray-500">Get started by creating a new board.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 btn-primary"
          >
            Create your first board
          </button>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowCreateModal(false)} />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Board</h2>
              {createError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm" role="alert">
                  {createError}
                </div>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label htmlFor="boardTitle" className="label">Board Title</label>
                  <input
                    id="boardTitle"
                    type="text"
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                    className="input"
                    required
                    maxLength={255}
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="jiraProjectKey" className="label">Jira Project Key (optional)</label>
                  <input
                    id="jiraProjectKey"
                    type="text"
                    value={newBoardJiraKey}
                    onChange={(e) => setNewBoardJiraKey(e.target.value.toUpperCase())}
                    className="input"
                    maxLength={50}
                    placeholder="PROJ"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Board'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}