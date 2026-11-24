import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApi, jiraApi } from '../../api/endpoints';
import type { Board } from '../../api/schema';
import { ConfirmButton } from '../../components/ConfirmButton';
import { JiraImportPanel } from './JiraImportPanel';
import { JiraConflictsPanel } from './JiraConflictsPanel';
import { JiraSyncLogsPanel } from './JiraSyncLogsPanel';

/** Remembers which board started the flow, so the callback page can link back to it. */
export const JIRA_BOARD_KEY = 'jiraConnectBoardId';

function JiraBoardRow({ board }: { board: Board }) {
  const queryClient = useQueryClient();
  const isAdmin = board.myRole === 'ADMIN';
  const { data: status, isLoading } = useQuery({
    queryKey: ['jira-connection', board.id],
    queryFn: () => jiraApi.connection(board.id),
  });

  const connect = useMutation({
    mutationFn: () => jiraApi.startOAuth(board.id),
    onSuccess: ({ authorizeUrl }) => {
      sessionStorage.setItem(JIRA_BOARD_KEY, board.id);
      window.location.assign(authorizeUrl);
    },
  });
  const disconnect = useMutation({
    mutationFn: () => jiraApi.disconnect(board.id),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: ['jira-connection', board.id] }),
  });

  const showReconnectWarning = status?.connected && status.requiresReconnect;

  return (
    <li className="card p-4" aria-label={`Jira connection of ${board.title}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to={`/boards/${board.id}`} className="font-medium text-primary-600">
            {board.title}
          </Link>
          <p className="text-sm text-gray-600">
            {isLoading && 'Checking...'}
            {status?.connected && (
              <>
                Connected to{' '}
                <a
                  href={status.siteUrl ?? undefined}
                  className="text-primary-600"
                  target="_blank"
                  rel="noreferrer"
                >
                  {status.siteUrl}
                </a>
                {status.connectedAt && ` since ${new Date(status.connectedAt).toLocaleString()}`}
              </>
            )}
            {status && !status.connected && 'Not connected'}
          </p>
        </div>
        {isAdmin ? (
          status?.connected ? (
            <ConfirmButton
              label="Disconnect"
              onConfirm={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            />
          ) : (
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={!status || connect.isPending}
              onClick={() => connect.mutate()}
            >
              Connect Jira
            </button>
          )
        ) : (
          <span className="text-xs text-gray-500">
            Only the board Admin can change the connection
          </span>
        )}
      </div>
      {showReconnectWarning && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 text-amber-800">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium">
              Jira connection needs to be reconnected
            </p>
          </div>
          <p className="mt-1 text-sm text-amber-700">
            The OAuth token has expired. Please disconnect and reconnect Jira to restore sync functionality.
          </p>
        </div>
      )}
      {status?.connected && (
        <>
          <JiraImportPanel board={board} />
          {isAdmin && <JiraConflictsPanel board={board} />}
          {isAdmin && <JiraSyncLogsPanel board={board} />}
        </>
      )}
    </li>
  );
}

export function JiraSyncPage() {
  const { data: boards, isLoading } = useQuery({
    queryKey: ['boards'],
    queryFn: () => boardsApi.list(),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Jira Sync</h1>
      <p className="text-gray-600 mb-4">
        Connect a board to a Jira Cloud site through Atlassian sign-in (OAuth 2.0).
      </p>
      {isLoading && <p>Loading boards...</p>}
      {boards && boards.length === 0 && (
        <p className="text-gray-600">
          No boards yet.{' '}
          <Link to="/boards" className="text-primary-600">
            Create one
          </Link>{' '}
          first.
        </p>
      )}
      <ul className="space-y-2">
        {boards?.map((board) => (
          <JiraBoardRow key={board.id} board={board} />
        ))}
      </ul>
    </div>
  );
}
