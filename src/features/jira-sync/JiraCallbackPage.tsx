import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { jiraApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { JiraOAuthCallbackResponse } from '../../api/schema';
import { JIRA_BOARD_KEY } from './JiraSyncPage';

type Outcome =
  | { kind: 'pending' }
  | { kind: 'ok'; result: JiraOAuthCallbackResponse }
  | { kind: 'failed'; message: string };

/** Atlassian redirects here (`JIRA_REDIRECT_URI`); the backend completes the flow. */
export function JiraCallbackPage() {
  const [params] = useSearchParams();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'pending' });
  const started = useRef(false);
  // Read once: the key is removed when the call finishes.
  const [boardId] = useState(() => sessionStorage.getItem(JIRA_BOARD_KEY));

  useEffect(() => {
    // A state is single-use: never send it twice (React strict mode runs effects twice).
    if (started.current) return;
    started.current = true;

    const state = params.get('state');
    if (!state) {
      setOutcome({ kind: 'failed', message: 'The Atlassian response has no state.' });
      return;
    }
    jiraApi
      .completeOAuth({
        state,
        code: params.get('code') ?? undefined,
        error: params.get('error') ?? undefined,
      })
      .then((result) => setOutcome({ kind: 'ok', result }))
      .catch((error: unknown) =>
        setOutcome({
          kind: 'failed',
          message:
            error instanceof ApiError
              ? error.messages.join(', ')
              : 'The connection could not be completed.',
        })
      )
      .finally(() => sessionStorage.removeItem(JIRA_BOARD_KEY));
  }, [params]);

  return (
    <div className="card p-6 max-w-lg">
      <h1 className="text-xl font-bold mb-2">Jira connection</h1>
      {outcome.kind === 'pending' && <p>Completing the connection...</p>}
      {outcome.kind === 'ok' && (
        <p>
          Connected to <strong>{outcome.result.siteUrl}</strong>.
        </p>
      )}
      {outcome.kind === 'failed' && (
        <p role="alert" className="text-red-700">
          Connection failed: {outcome.message}
        </p>
      )}
      <div className="flex gap-3 mt-4">
        <Link to="/jira-sync" className="btn-primary text-sm">
          {outcome.kind === 'failed' ? 'Try again' : 'Back to Jira Sync'}
        </Link>
        {boardId && (
          <Link to={`/boards/${boardId}`} className="btn-secondary text-sm">
            Open the board
          </Link>
        )}
      </div>
    </div>
  );
}
