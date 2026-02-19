import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PhaserOffice } from '../components/phaser/PhaserOffice';
import { SyncPanel } from '../components/SyncPanel';
import type { Project } from '../types';
import type { SceneConfig } from '../types/tilemap';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    archived: 'bg-gray-500/20 text-gray-400',
    completed: 'bg-blue-500/20 text-blue-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[status] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[priority] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {priority}
    </span>
  );
}

const taskStatusColors: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
  blocked: 'bg-orange-500/20 text-orange-400',
};

const agentStatusColors: Record<string, string> = {
  inactive: 'bg-gray-500',
  idle: 'bg-green-500',
  working: 'bg-yellow-500',
  completed: 'bg-blue-500',
  failed: 'bg-red-500',
};

function ProjectSidebar({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { t } = useTranslation();

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => api.getProject(projectId),
  });

  if (isLoading) {
    return (
      <div className="p-4 text-gray-400 text-sm">{t('loading')}</div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 text-red-400 text-sm">{t('error')}</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="font-semibold truncate">{project.display_name}</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Status & Priority */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/50">
          <StatusBadge status={project.status} />
          <PriorityBadge priority={project.priority} />
        </div>

        {project.description && (
          <p className="text-xs text-gray-400 px-4 py-2 border-b border-gray-800/50">
            {project.description}
          </p>
        )}

        {/* Agents */}
        <div className="px-4 py-3 border-b border-gray-800/50">
          <span className="text-xs font-medium text-gray-400">{t('agents')} ({project.agents.length})</span>
          <div className="mt-2 space-y-1">
            {project.agents.map((agent) => (
              <Link
                key={agent.id}
                to={`/agents/${agent.id}`}
                className="flex items-center gap-2 p-2 rounded hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-sm">{agent.emoji || '🤖'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{agent.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{agent.role}</p>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 ${agentStatusColors[agent.status] ?? 'bg-gray-500'}`} />
              </Link>
            ))}
            {project.agents.length === 0 && (
              <p className="text-xs text-gray-500">{t('noData')}</p>
            )}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="px-4 py-3">
          <span className="text-xs font-medium text-gray-400">{t('tasks')} (recent)</span>
          <div className="mt-2 space-y-1">
            {project.recent_tasks.slice(0, 8).map((task) => (
              <div key={task.id} className="flex items-center gap-2 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${taskStatusColors[task.status] ?? ''}`}>
                  {t(task.status)}
                </span>
                <span className="text-xs truncate flex-1">{task.title}</span>
              </div>
            ))}
            {project.recent_tasks.length === 0 && (
              <p className="text-xs text-gray-500">{t('noData')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  });
  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000,
  });
  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAllAgents,
    refetchInterval: 5000,
  });
  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks(),
  });
  const { data: activityData } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.getActivity({ limit: 30 }),
  });

  const projects = projectsData?.data ?? [];
  const totalAgents = projects.reduce((s, p) => s + (p.agent_count ?? 0), 0);
  const totalTasks = projects.reduce((s, p) => s + (p.task_count ?? 0), 0);

  // Find global office config: use first project with tilemap, or first project as save target
  const officeProject = useMemo(() => {
    const withTilemap = projects.find((p) => {
      if (!p.scene_config) return false;
      try {
        const sc = JSON.parse(p.scene_config) as SceneConfig;
        return !!sc.tilemap;
      } catch { return false; }
    });
    return withTilemap ?? projects[0] ?? null;
  }, [projects]);

  const officeSceneConfig = officeProject?.scene_config ?? null;

  if (isLoading) return <div className="p-8 text-gray-400">{t('loading')}</div>;

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: t('totalProjects'), value: projects.length },
              { label: t('totalAgents'), value: totalAgents },
              { label: t('totalTasks'), value: totalTasks },
              { label: t('uptime'), value: healthData ? `${Math.floor(healthData.uptime / 60)}m` : '-' },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Office View */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-semibold">Office</span>
              {officeProject && (
                <button
                  onClick={() => navigate(`/projects/${officeProject.id}/editor`)}
                  className="px-3 py-1.5 text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white rounded border border-gray-700 transition-colors"
                >
                  Customize Office
                </button>
              )}
            </div>
            <PhaserOffice
              agents={agentsData?.data ?? []}
              sceneConfig={officeSceneConfig}
            />
          </div>

          {/* Projects */}
          <h3 className="text-lg font-semibold mb-4">{t('projects')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {projects.map((project: Project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProjectId(
                  selectedProjectId === project.id ? null : project.id,
                )}
                className={`text-left bg-gray-900 rounded-xl p-5 border transition-colors ${
                  selectedProjectId === project.id
                    ? 'border-blue-500/50 bg-blue-500/5'
                    : 'border-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{project.display_name}</h4>
                  <StatusBadge status={project.status} />
                </div>
                {project.description && (
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{project.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{project.agent_count ?? 0} {t('agents')}</span>
                  <span>{project.task_count ?? 0} {t('tasks')}</span>
                  <PriorityBadge priority={project.priority} />
                </div>
              </button>
            ))}
            {projects.length === 0 && (
              <p className="text-gray-500 col-span-full">{t('noData')}</p>
            )}
          </div>

          {/* Project Sync */}
          <div className="mb-8">
            <SyncPanel />
          </div>

          {/* Tasks & Activity side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tasks */}
            <div>
              <h3 className="text-lg font-semibold mb-4">{t('tasks')}</h3>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="text-left p-3">Title</th>
                      <th className="text-left p-3">{t('status')}</th>
                      <th className="text-left p-3">{t('priority')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tasksData?.data ?? []).slice(0, 10).map((task) => (
                      <tr key={task.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="p-3 truncate max-w-48">{task.title}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${taskStatusColors[task.status] ?? ''}`}>
                            {t(task.status)}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400">{task.priority}</td>
                      </tr>
                    ))}
                    {(tasksData?.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-3 text-gray-500 text-center">{t('noData')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Activity */}
            <div>
              <h3 className="text-lg font-semibold mb-4">{t('activity')}</h3>
              <div className="space-y-2">
                {(activityData?.data ?? []).slice(0, 10).map((act) => (
                  <div key={act.id} className="flex items-start gap-3 bg-gray-900 rounded-lg p-3 border border-gray-800">
                    <span className="text-gray-500 text-xs w-32 shrink-0 pt-0.5">
                      {new Date(act.created_at).toLocaleString()}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-200">{act.action}</span>
                      {act.details_json && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{act.details_json.slice(0, 80)}</p>
                      )}
                    </div>
                  </div>
                ))}
                {(activityData?.data ?? []).length === 0 && (
                  <p className="text-gray-500">{t('noData')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar: Project detail */}
      {selectedProjectId && (
        <aside className="w-80 shrink-0 bg-gray-900 border-l border-gray-800 overflow-hidden">
          <ProjectSidebar
            projectId={selectedProjectId}
            onClose={() => setSelectedProjectId(null)}
          />
        </aside>
      )}
    </div>
  );
}
