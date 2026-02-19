import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Project } from '../types';

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

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  });
  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="p-8 text-gray-400">{t('loading')}</div>;

  const projects = projectsData?.data ?? [];
  const totalAgents = projects.reduce((s, p) => s + (p.agent_count ?? 0), 0);
  const totalTasks = projects.reduce((s, p) => s + (p.task_count ?? 0), 0);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">{t('dashboard')}</h2>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: t('totalProjects'), value: projects.length, color: 'blue' },
          { label: t('totalAgents'), value: totalAgents, color: 'green' },
          { label: t('totalTasks'), value: totalTasks, color: 'purple' },
          { label: t('uptime'), value: healthData ? `${Math.floor(healthData.uptime / 60)}m` : '-', color: 'yellow' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-sm text-gray-400">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Projects */}
      <h3 className="text-lg font-semibold mb-4">{t('projects')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project: Project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-600 transition-colors"
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
          </Link>
        ))}
        {projects.length === 0 && (
          <p className="text-gray-500 col-span-full">{t('noData')}</p>
        )}
      </div>
    </div>
  );
}
