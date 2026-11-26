import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { boardsApi, jiraApi } from '../../api/endpoints';
import type { Board, JiraSyncLog, JiraSyncStatus } from '../../api/schema';

type StatusFilter = 'ALL' | JiraSyncStatus;

const FILTERS: StatusFilter[] = ['ALL', 'FAILED', 'CONFLICT', 'SUCCESS'];

const STATUS_BADGE: Record<JiraSyncStatus, string> = {
  SUCCESS: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CONFLICT: 'bg-yellow-100 text-yellow-800',
};

const ROW_STYLE: Record<JiraSyncStatus, string> = {
  SUCCESS: 'bg-green-50 border-green-200',
  FAILED: 'bg-red-50 border-red-200',
  CONFLICT: 'bg-yellow-50 border-yellow-200',
};

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** Read-only list of the board's Jira sync log (Admin). Status moves are retried by the outbox. */
export function JiraSyncLogsPanel({ board, siteUrl }: { board: Board; siteUrl?: string | null }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      // The filter is part of the key: changing it refetches from the server with a fresh cursor.
      queryKey: ['jira-sync-logs', board.id, statusFilter],
      queryFn: ({ pageParam }) =>
        jiraApi.syncLogs(board.id, {
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          cursor: pageParam,
        }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    });

  // Same key as the board page, so the columns are usually cached already.
  const { data: boardDetail } = useQuery({
    queryKey: ['board', board.id],
    queryFn: () => boardsApi.get(board.id),
  });
  const columnTitle = (id: string | undefined) =>
    id ? (boardDetail?.columns.find((c) => c.id === id)?.title ?? 'a deleted column') : undefined;

  const logs = (data?.pages ?? []).flatMap((page) => page.items);
  const browseBase = siteUrl?.replace(/\/+$/, '');

  const row = (log: JiraSyncLog) => {
    const payload = log.payload ?? {};
    const issueKey = text(payload.issueKey);
    const from = columnTitle(text(payload.fromColumnId));
    const to = columnTitle(text(payload.toColumnId));
    return (
      <li key={log.id} className={`p-3 rounded-lg border ${ROW_STYLE[log.status]}`}>
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 text-[10px] rounded ${STATUS_BADGE[log.status]}`}>
              {log.status}
            </span>
            <span className="text-xs text-gray-700">
              {log.direction === 'TO_JIRA' ? '→ Jira' : '← Jira'}
            </span>
            {issueKey &&
              (browseBase ? (
                <a
                  href={`${browseBase}/browse/${issueKey}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-primary-600 underline"
                >
                  {issueKey}
                </a>
              ) : (
                <span className="font-mono text-xs text-gray-700">{issueKey}</span>
              ))}
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {new Date(log.createdAt).toLocaleString()}
          </span>
        </div>
        {text(payload.commentId) && <p className="text-xs text-gray-600">Comment sync</p>}
        {(from || to) && (
          <p className="text-xs text-gray-600">
            {from && `from ${from}`}
            {from && to && ' → '}
            {to && `to ${to}`}
          </p>
        )}
        {log.errorMessage && (
          <p className="text-xs text-red-700 mt-1 font-mono">{log.errorMessage}</p>
        )}
      </li>
    );
  };

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Filter by status">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={statusFilter === filter}
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

      {isLoading && <p className="text-sm text-gray-500">Loading sync logs...</p>}
      {isError && (
        <p role="alert" className="text-sm text-red-600">
          Could not load sync logs: {error.message}
        </p>
      )}
      {!isLoading && !isError && logs.length === 0 && (
        <p className="text-sm text-gray-500">
          No sync logs{statusFilter !== 'ALL' ? ` with status ${statusFilter}` : ''}.
        </p>
      )}

      {logs.length > 0 && (
        <ul
          className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-2"
          aria-label="Sync logs"
          tabIndex={0}
        >
          {logs.map(row)}
        </ul>
      )}

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
