import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jiraApi } from '../../api/endpoints';
import type { Board, JiraSyncLog, JiraSyncStatus } from '../../api/schema';

type StatusFilter = 'ALL' | 'FAILED' | 'CONFLICT' | 'SUCCESS';

function getStatusColor(status: JiraSyncStatus): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-green-100 text-green-800';
    case 'FAILED':
      return 'bg-red-100 text-red-800';
    case 'CONFLICT':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getDirectionBadge(direction: string): string {
  if (direction === 'TO_JIRA') return 'bg-blue-100 text-blue-800';
  if (direction === 'FROM_JIRA') return 'bg-purple-100 text-purple-800';
  return 'bg-gray-100 text-gray-800';
}

function isRetryable(log: JiraSyncLog): boolean {
  if (log.status !== 'FAILED') return false;
  const outcome = log.payload?.outcome as string | undefined;
  if (outcome === 'unknown') return false;
  if (log.direction === 'TO_JIRA') {
    const hasTransitionData = !!log.payload?.fromColumnId && !!log.payload?.toColumnId;
    const hasCommentData = !!log.payload?.commentId;
    return hasTransitionData || hasCommentData;
  }
  return false;
}

export function JiraSyncLogsPanel({ board }: { board: Board }) {
  const queryClient = useQueryClient();
  const queryKey = ['jira-sync-logs', board.id];

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey,
      queryFn: ({ pageParam }) =>
        jiraApi.syncLogs(board.id, {
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          cursor: pageParam,
        }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    });

  const retry = useMutation({
    mutationFn: (logId: string) => jiraApi.retrySyncLog(logId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    },
  });

  const allLogs = (data?.pages ?? []).flatMap((page) => page.items);
  const filteredLogs = allLogs.filter((log) => {
    if (statusFilter === 'ALL') return true;
    return log.status === statusFilter;
  });

  if (isLoading) return <p className="text-sm text-gray-500 mt-4">Loading sync logs...</p>;
  if (isError) {
    return (
      <p role="alert" className="text-sm text-red-600 mt-4">
        Could not load sync logs: {error.message}
      </p>
    );
  }

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex flex-wrap gap-2 mb-3">
        {(['ALL', 'FAILED', 'CONFLICT', 'SUCCESS'] as StatusFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            className={`btn-xs ${
              statusFilter === filter
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setStatusFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {retry.isError && (
        <p role="alert" className="text-sm text-red-600 mb-2">
          Could not retry sync log: {retry.error.message}
        </p>
      )}

      {filteredLogs.length === 0 && (
        <p className="text-sm text-gray-500">
          No sync logs {statusFilter !== 'ALL' ? `with status ${statusFilter}` : ''}.
        </p>
      )}

      <ul className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-2">
        {filteredLogs.map((log) => {
          const busy = retry.isPending && (retry.variables as string | undefined) === log.id;
          const payload = log.payload ?? {};
          const issueKey = payload.issueKey as string | undefined;
          const cardId = payload.cardId as string | undefined;
          const fromColumnId = payload.fromColumnId as string | undefined;
          const toColumnId = payload.toColumnId as string | undefined;
          const commentId = payload.commentId as string | undefined;
          const text = payload.text as string | undefined;
          const errorMessage = log.errorMessage;

          return (
            <li
              key={log.id}
              className={`p-3 rounded-lg border ${
                log.status === 'FAILED'
                  ? 'bg-red-50 border-red-200'
                  : log.status === 'CONFLICT'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-green-50 border-green-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-600">{log.id.slice(0, 8)}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded ${getStatusColor(log.status)}`}>
                    {log.status}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded ${getDirectionBadge(log.direction)}`}>
                    {log.direction === 'TO_JIRA' ? '→ Jira' : '← Jira'}
                  </span>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>

              {issueKey && (
                <p className="font-mono text-xs text-blue-600 mb-1">
                  Issue: <a href="#" className="underline">{issueKey}</a>
                </p>
              )}

              {cardId && (
                <p className="text-xs text-gray-600 mb-1">Card: {cardId.slice(0, 8)}</p>
              )}

              {(fromColumnId || toColumnId) && (
                <p className="text-xs text-gray-600 mb-1">
                  {fromColumnId ? `from ${fromColumnId.slice(0, 8)}` : ''}
                  {fromColumnId && toColumnId ? ' → ' : ''}
                  {toColumnId ? `to ${toColumnId.slice(0, 8)}` : ''}
                </p>
              )}

              {commentId && text && (
                <p className="text-xs text-gray-600 mb-1 italic">
                  Comment: {text.length > 50 ? text.slice(0, 50) + '...' : text}
                </p>
              )}

              {errorMessage && (
                <p className="text-xs text-red-600 mb-1 font-mono">{errorMessage}</p>
              )}

              {isRetryable(log) && (
                <div className="mt-2 pt-2 border-t border-current/20">
                  <button
                    type="button"
                    className="btn-xs bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => retry.mutate(log.id)}
                  >
                    {busy ? 'Retrying...' : 'Retry'}
                  </button>
                </div>
              )}
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