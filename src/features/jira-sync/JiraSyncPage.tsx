import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jiraSyncApi } from '../../api/endpoints';
import type { JiraIssueMapping, SyncLog } from '../../types';

export function JiraSyncPage() {
  const queryClient = useQueryClient();
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [jiraIssueKey, setJiraIssueKey] = useState('');
  const [jiraIssueId, setJiraIssueId] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [mapError, setMapError] = useState('');

  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['jiraMappings'],
    queryFn: () => jiraSyncApi.listMappings(''), // Will need boardId
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['syncLogs'],
    queryFn: () => jiraSyncApi.getSyncLogs(''),
  });

  const createMappingMutation = useMutation({
    mutationFn: jiraSyncApi.createMapping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jiraMappings'] });
      setShowMapModal(false);
      setSelectedCardId(null);
      setJiraIssueKey('');
      setJiraIssueId('');
      setJiraProjectKey('');
      setMapError('');
    },
    onError: (err: any) => {
      setMapError(err.message || 'Failed to create mapping');
    },
  });

  const syncMutation = useMutation({
    mutationFn: jiraSyncApi.syncCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
    },
  });

  const handleMapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId || !jiraIssueKey || !jiraIssueId || !jiraProjectKey) return;
    createMappingMutation.mutate({
      boardId: '', // Would need current board
      cardId: selectedCardId,
      jiraIssueKey,
      jiraIssueId,
      jiraProjectKey,
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Jira Synchronization</h1>
      </div>

      <div className="card p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Issue Mappings</h2>
        {mappingsLoading ? (
          <div className="text-center text-gray-500 py-8">Loading mappings...</div>
        ) : mappings && mappings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Jira Issue</th>
                  <th className="pb-3 font-medium">Project</th>
                  <th className="pb-3 font-medium">Card</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mappings.map((mapping: JiraIssueMapping) => (
                  <tr key={mapping.id} className="hover:bg-gray-50">
                    <td className="py-4">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{mapping.jiraIssueKey}</code>
                    </td>
                    <td className="py-4 text-sm text-gray-600">{mapping.jiraProjectKey}</td>
                    <td className="py-4 text-sm text-gray-600">{mapping.cardId || 'Not linked'}</td>
                    <td className="py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Synced
                      </span>
                    </td>
                    <td className="py-4">
                      <button
                        onClick={() => syncMutation.mutate(mapping.cardId || '')}
                        disabled={syncMutation.isPending || !mapping.cardId}
                        className="btn-secondary text-sm"
                      >
                        Sync Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">No mappings yet</div>
        )}
      </div>

      <div className="card p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Sync History</h2>
        </div>
        {logsLoading ? (
          <div className="text-center text-gray-500 py-8">Loading logs...</div>
        ) : logs && logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Direction</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Issue</th>
                  <th className="pb-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log: SyncLog) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        log.direction === 'TO_JIRA' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {log.direction === 'TO_JIRA' ? '→ Jira' : '← Jira'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        log.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                        log.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600">{log.mappingId}</td>
                    <td className="py-3 text-sm text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">No sync history</div>
        )}
      </div>

      {showMapModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowMapModal(false)} />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Map Card to Jira Issue</h2>
              {mapError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm" role="alert">
                  {mapError}
                </div>
              )}
              <form onSubmit={handleMapSubmit} className="space-y-4">
                <div>
                  <label htmlFor="jiraIssueKey" className="label">Jira Issue Key</label>
                  <input
                    id="jiraIssueKey"
                    type="text"
                    value={jiraIssueKey}
                    onChange={(e) => setJiraIssueKey(e.target.value.toUpperCase())}
                    className="input"
                    required
                    placeholder="PROJ-123"
                  />
                </div>
                <div>
                  <label htmlFor="jiraIssueId" className="label">Jira Issue ID</label>
                  <input
                    id="jiraIssueId"
                    type="text"
                    value={jiraIssueId}
                    onChange={(e) => setJiraIssueId(e.target.value)}
                    className="input"
                    required
                    placeholder="10001"
                  />
                </div>
                <div>
                  <label htmlFor="jiraProjectKey" className="label">Jira Project Key</label>
                  <input
                    id="jiraProjectKey"
                    type="text"
                    value={jiraProjectKey}
                    onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                    className="input"
                    required
                    placeholder="PROJ"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setShowMapModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={createMappingMutation.isPending}>
                    {createMappingMutation.isPending ? 'Mapping...' : 'Create Mapping'}
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