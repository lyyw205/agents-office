import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

const statusColors: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
  blocked: 'bg-orange-500/20 text-orange-400',
};

export function TasksPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks(),
  });

  if (isLoading) return <div className="p-8 text-gray-400">{t('loading')}</div>;

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">{t('tasks')}</h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">{t('status')}</th>
              <th className="text-left p-3">{t('priority')}</th>
              <th className="text-left p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((task) => (
              <tr key={task.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-3">{task.title}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${statusColors[task.status] ?? ''}`}>
                    {t(task.status)}
                  </span>
                </td>
                <td className="p-3 text-gray-400">{task.priority}</td>
                <td className="p-3 text-gray-400">{new Date(task.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {(data?.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="p-3 text-gray-500 text-center">{t('noData')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
