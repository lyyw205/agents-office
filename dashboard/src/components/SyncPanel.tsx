import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { DiscoveredProject, SyncResult } from '../types';

export function SyncPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [discovered, setDiscovered] = useState<DiscoveredProject[]>([]);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);

  const { data: syncStatus } = useQuery({
    queryKey: ['syncStatus'],
    queryFn: api.getSyncStatus,
    refetchInterval: 30000,
  });

  const discoverMutation = useMutation({
    mutationFn: () => api.discoverProjects(),
    onSuccess: (data) => {
      setDiscovered(data.discovered);
      setSyncResults([]);
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: () => api.syncProjects(),
    onSuccess: (data) => {
      setSyncResults(data.synced);
      setDiscovered([]);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
    },
  });

  const statusColor = (s: SyncResult['status']) => {
    if (s === 'created') return 'text-green-400';
    if (s === 'updated') return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Project Sync</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => discoverMutation.mutate()}
            disabled={discoverMutation.isPending}
            className="px-3 py-1.5 text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white rounded border border-gray-700 transition-colors disabled:opacity-50"
          >
            {discoverMutation.isPending ? 'Scanning...' : 'Discover'}
          </button>
          <button
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
          >
            {syncAllMutation.isPending ? 'Syncing...' : 'Sync All'}
          </button>
        </div>
      </div>

      {/* Status bar */}
      {syncStatus && (
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
          <span>Synced: {syncStatus.synced_projects} projects</span>
          {syncStatus.last_run && (
            <span>Last: {new Date(syncStatus.last_run).toLocaleString()}</span>
          )}
          <span className="truncate">Paths: {syncStatus.scan_paths.join(', ')}</span>
        </div>
      )}

      {/* Discovered projects */}
      {discovered.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-400 mb-2">
            Discovered ({discovered.length})
          </p>
          <div className="space-y-1">
            {discovered.map((d) => (
              <div
                key={d.path}
                className="flex items-center justify-between p-2 bg-gray-800/50 rounded text-xs"
              >
                <div className="min-w-0">
                  <span className="font-medium text-gray-200">{d.project_name}</span>
                  <span className="text-gray-500 ml-2 truncate">{d.path}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  {d.has_team_config && (
                    <span className="text-green-400">team-config</span>
                  )}
                  {d.has_persona && (
                    <span className="text-blue-400">persona</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync results */}
      {syncResults.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2">
            Sync Results ({syncResults.length})
          </p>
          <div className="space-y-1">
            {syncResults.map((r) => (
              <div
                key={r.project_id}
                className="flex items-center justify-between p-2 bg-gray-800/50 rounded text-xs"
              >
                <span className="font-medium text-gray-200">{r.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">
                    {r.agents_count} agents, {r.workflows_count} workflows
                  </span>
                  <span className={statusColor(r.status)}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error states */}
      {discoverMutation.isError && (
        <p className="text-xs text-red-400 mt-2">
          Discover failed: {(discoverMutation.error as Error).message}
        </p>
      )}
      {syncAllMutation.isError && (
        <p className="text-xs text-red-400 mt-2">
          Sync failed: {(syncAllMutation.error as Error).message}
        </p>
      )}
    </div>
  );
}
