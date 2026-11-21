import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jiraApi } from '../../api/endpoints';
import type { Board, ResolveJiraConflictRequest } from '../../api/schema';

export function JiraConflictsPanel({ board }: { board: Board }) {
  const queryClient = useQueryClient();
  const queryKey = ['jira-conflicts', board.id];

  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey,
      queryFn: ({ pageParam }) => jiraApi.conflicts(board.id, pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    });

  const resolve = useMutation({
    mutationFn: ({
      conflictId,
      resolution,
    }: {
      conflictId: string;
      resolution: ResolveJiraConflictRequest['resolution'];
    }) => jiraApi.resolveConflict(conflictId, resolution),
    // Also on error: a 409 means somebody resolved it already, so reload the list.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      // Either resolution can move the card.
      void queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    },
  });

  if (isLoading) return <p className="text-sm text-gray-500 mt-4">Loading conflicts...</p>;
  if (isError) {
    return (
      <p role="alert" className="text-sm text-red-600 mt-4">
        Could not load sync conflicts: {error.message}
      </p>
    );
  }

  const conflicts = (data?.pages ?? []).flatMap((page) => page.items).filter((c) => !c.resolvedAt);

  return (
    <div className="mt-4 border-t pt-4">
      <h3 className="text-sm font-semibold text-red-600 mb-3">Sync conflicts</h3>
      {resolve.isError && (
        <p role="alert" className="text-sm text-red-600 mb-2">
          Could not resolve the conflict: {resolve.error.message}
        </p>
      )}
      {conflicts.length === 0 && <p className="text-sm text-gray-500">No sync conflicts.</p>}
      <ul className="space-y-3">
        {conflicts.map((conflict) => {
          const busy = resolve.isPending && resolve.variables?.conflictId === conflict.id;
          return (
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
                  disabled={busy}
                  onClick={() => resolve.mutate({ conflictId: conflict.id, resolution: 'jira' })}
                >
                  Keep Jira version
                </button>
                <button
                  type="button"
                  className="btn-primary text-xs bg-red-600 hover:bg-red-700 ring-red-600 border-none"
                  disabled={busy}
                  onClick={() =>
                    resolve.mutate({ conflictId: conflict.id, resolution: 'boardsync' })
                  }
                >
                  Push Board version
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {hasNextPage && (
        <button
          type="button"
          className="btn-secondary text-xs mt-3"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Load more
        </button>
      )}
    </div>
  );
}
