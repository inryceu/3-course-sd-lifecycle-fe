import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApi, jiraApi } from '../../api/endpoints';
import type { Board, JiraImportResult } from '../../api/schema';

const PROJECT_KEY = /^[A-Z][A-Z0-9_]{1,9}$/;

/**
 * Project link, import and status → column mapping of a connected board. The Admin edits; other
 * members see the mapping read-only.
 */
export function JiraImportPanel({ board }: { board: Board }) {
  const queryClient = useQueryClient();
  const isAdmin = board.myRole === 'ADMIN';
  const [projectKey, setProjectKey] = useState(board.jiraProjectKey ?? '');
  const [result, setResult] = useState<JiraImportResult | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const linkedKey = board.jiraProjectKey;

  const { data: detail } = useQuery({
    queryKey: ['board', board.id],
    queryFn: () => boardsApi.get(board.id),
  });
  const mappings = useQuery({
    queryKey: ['jira-status-mappings', board.id],
    queryFn: () => jiraApi.statusMappings(board.id),
    enabled: !!linkedKey,
    retry: false,
  });

  const runImport = useMutation({
    mutationFn: () => jiraApi.importIssues(board.id, projectKey || undefined),
    onSuccess: (res) => {
      setResult(res);
      void queryClient.invalidateQueries({ queryKey: ['boards'] });
      void queryClient.invalidateQueries({ queryKey: ['board', board.id] });
      void queryClient.invalidateQueries({ queryKey: ['jira-status-mappings', board.id] });
    },
  });
  const save = useMutation({
    mutationFn: () =>
      jiraApi.saveStatusMappings(
        board.id,
        Object.entries(draft).map(([jiraStatusId, columnId]) => ({ jiraStatusId, columnId }))
      ),
    onSuccess: (saved) => {
      setDraft({});
      queryClient.setQueryData(['jira-status-mappings', board.id], saved);
    },
  });

  const onImport = (event: FormEvent) => {
    event.preventDefault();
    if (PROJECT_KEY.test(projectKey)) runImport.mutate();
  };
  const columns = detail?.columns ?? [];

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
      {isAdmin && (
        <form
          onSubmit={onImport}
          className="flex flex-wrap items-end gap-2"
          aria-label="Import issues"
        >
          <div>
            <label className="label" htmlFor={`project-${board.id}`}>
              Jira project key
            </label>
            <input
              id={`project-${board.id}`}
              className="input w-36 uppercase"
              placeholder="KAN"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
            />
          </div>
          <button
            type="submit"
            className="btn-primary text-sm"
            disabled={!PROJECT_KEY.test(projectKey) || runImport.isPending}
          >
            {runImport.isPending ? 'Importing...' : 'Import open issues'}
          </button>
          {result && (
            <p role="status" className="text-sm text-gray-700">
              Imported {result.imported}: {result.created} created, {result.updated} updated,{' '}
              {result.skipped} unchanged.
            </p>
          )}
        </form>
      )}
      {!isAdmin && (
        <p className="text-sm text-gray-600">Jira project: {linkedKey ?? 'not linked yet'}</p>
      )}

      {linkedKey && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Status → column ({linkedKey})</h3>
          {mappings.isLoading && <p className="text-sm">Loading statuses...</p>}
          {mappings.isError && (
            <p role="alert" className="text-sm text-red-700">
              Could not read the project statuses.
            </p>
          )}
          {mappings.data && (
            <table className="text-sm" aria-label={`Status mapping of ${board.title}`}>
              <tbody>
                {mappings.data.map((m) => (
                  <tr key={m.jiraStatusId}>
                    <td className="pr-3 py-1">{m.jiraStatusName}</td>
                    <td className="py-1">
                      <select
                        aria-label={`Column for ${m.jiraStatusName}`}
                        className="input py-1 text-sm w-48"
                        disabled={!isAdmin}
                        value={draft[m.jiraStatusId] ?? m.columnId}
                        onChange={(e) => setDraft({ ...draft, [m.jiraStatusId]: e.target.value })}
                      >
                        {columns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="pl-2 text-xs text-gray-500">{m.isDefault ? 'default' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {isAdmin && Object.keys(draft).length > 0 && (
            <button
              type="button"
              className="btn-primary text-sm mt-2"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              Save mapping
            </button>
          )}
        </div>
      )}
    </div>
  );
}
