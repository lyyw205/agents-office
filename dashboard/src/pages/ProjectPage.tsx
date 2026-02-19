import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { PhaserOffice } from '../components/phaser/PhaserOffice';

const statusColors: Record<string, string> = {
  inactive: 'bg-gray-500',
  idle: 'bg-green-500',
  working: 'bg-yellow-500',
  completed: 'bg-blue-500',
  failed: 'bg-red-500',
};

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });

  const { data: workflowsData } = useQuery({
    queryKey: ['workflows', id],
    queryFn: () => api.getWorkflows(id),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-gray-400">{t('loading')}</div>;
  if (!project) return <div className="p-8 text-red-400">{t('error')}</div>;

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-400 hover:text-gray-200">&larr;</Link>
        <h2 className="text-2xl font-bold">{project.display_name}</h2>
      </div>

      {/* Office Visualization */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">Office View</span>
          <button
            className="px-3 py-1.5 text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white rounded border border-gray-700 transition-colors"
            onClick={() => navigate(`/projects/${id}/editor`)}
          >
            Customize Office
          </button>
        </div>
        <PhaserOffice agents={project.agents} sceneConfig={project.scene_config} />
      </div>

      {/* Agents */}
      <h3 className="text-lg font-semibold mb-4">{t('agents')} ({project.agents.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {project.agents.map((agent) => (
          <Link
            key={agent.id}
            to={`/agents/${agent.id}`}
            className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{agent.emoji || '🤖'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{agent.name}</p>
                <p className="text-xs text-gray-400">{agent.role}</p>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full ${statusColors[agent.status] ?? 'bg-gray-500'}`} />
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Tasks */}
      <h3 className="text-lg font-semibold mb-4">{t('tasks')} (recent)</h3>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">{t('status')}</th>
              <th className="text-left p-3">{t('priority')}</th>
            </tr>
          </thead>
          <tbody>
            {project.recent_tasks.map((task) => (
              <tr key={task.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-3">{task.title}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{t(task.status)}</span>
                </td>
                <td className="p-3 text-gray-400">{task.priority}</td>
              </tr>
            ))}
            {project.recent_tasks.length === 0 && (
              <tr>
                <td colSpan={3} className="p-3 text-gray-500 text-center">{t('noData')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Workflows */}
      <h3 className="text-lg font-semibold mb-4">{t('workflows')}</h3>
      <div className="space-y-3">
        {(workflowsData?.data ?? []).map((wf) => (
          <div key={wf.id} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between">
              <p className="font-medium">{wf.name}</p>
              <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{wf.status}</span>
            </div>
            {wf.description && <p className="text-sm text-gray-400 mt-1">{wf.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
