import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jiraApi } from '../../api/endpoints';
import type { Board } from '../../api/schema';

export function JiraConflictsPanel({ board }: { board: Board }) {
  const queryClient = useQueryClient();
  const queryKey = ['jira-conflicts', board.id];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => jiraApi.conflicts(board.id),
  });

  const resolve = useMutation({
    mutationFn: ({
      conflictId,
      resolution,
    }: {
      conflictId: string;
      resolution: 'JIRA' | 'BOARD';
    }) => jiraApi.resolveConflict(conflictId, resolution),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (isLoading) return <p className="text-sm text-gray-500 mt-4">Loading conflicts...</p>;

  const conflicts = data?.items ?? [];
  if (conflicts.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-4">
      <h3 className="text-sm font-semibold text-red-600 mb-3">⚠️ Sync Conflicts Detected</h3>
      <ul className="space-y-3">
        {conflicts.map((conflict) => (
          <li
            key={conflict.id}
            className="bg-red-50 p-3 rounded-lg border border-red-200 shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-red-800">Card {conflict.jiraIssueKey}</span>
              <span className="text-xs text-red-500">
                {new Date(conflict.detectedAt).toLocaleString()}
              </span>
            </div>
            <div className="text-gray-700 text-xs mb-3 space-y-1">
              <p>
                <strong>Board status:</strong> {conflict.boardStatus}
              </p>
              <p>
                <strong>Jira status:</strong> {conflict.jiraStatus}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-xs bg-white"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ conflictId: conflict.id, resolution: 'JIRA' })}
              >
                Keep Jira version
              </button>
              <button
                type="button"
                className="btn-primary text-xs bg-red-600 hover:bg-red-700 ring-red-600 border-none"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ conflictId: conflict.id, resolution: 'BOARD' })}
              >
                Push Board version
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
