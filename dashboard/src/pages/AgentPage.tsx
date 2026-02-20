import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

export function AgentPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agents', id],
    queryFn: () => api.getAgent(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-gray-400">{t('loading')}</div>;
  if (!agent) return <div className="p-8 text-red-400">{t('error')}</div>;

  const persona = agent.persona_json ? JSON.parse(agent.persona_json) : null;

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to={-1 as unknown as string} className="text-gray-400 hover:text-gray-200">&larr;</Link>
        <span className="text-3xl">{agent.emoji || '🤖'}</span>
        <div>
          <h2 className="text-2xl font-bold">{agent.name}</h2>
          <p className="text-gray-400">
            {agent.role} · {t(`agentType.${agent.agent_type}` as Parameters<typeof t>[0])} · {t(`modelTier.${agent.model_tier}` as Parameters<typeof t>[0])}
          </p>
        </div>
      </div>

      {/* Persona */}
      {persona && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
          <h3 className="font-semibold mb-3">Persona</h3>
          {persona.backstory && (
            typeof persona.backstory === 'string'
              ? <p className="text-sm text-gray-300 mb-2">{persona.backstory}</p>
              : <div className="text-sm text-gray-300 mb-2 space-y-1">
                  {Object.entries(persona.backstory as Record<string, unknown>).map(([k, v]) => (
                    <p key={k}><span className="text-gray-500">{k}:</span> {String(v)}</p>
                  ))}
                </div>
          )}
          {persona.personality && (
            typeof persona.personality === 'string'
              ? <p className="text-sm text-gray-400">{persona.personality}</p>
              : <div className="text-sm text-gray-400 space-y-1">
                  {Object.entries(persona.personality as Record<string, unknown>).map(([k, v]) => (
                    <p key={k}><span className="text-gray-500">{k}:</span> {String(v)}</p>
                  ))}
                </div>
          )}
        </div>
      )}

      {/* Tasks */}
      <h3 className="text-lg font-semibold mb-4">{t('tasks')}</h3>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">{t('status')}</th>
              <th className="text-left p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {agent.tasks.map((task) => (
              <tr key={task.id} className="border-b border-gray-800/50">
                <td className="p-3">{task.title}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{task.status}</span>
                </td>
                <td className="p-3 text-gray-400">{new Date(task.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {agent.tasks.length === 0 && (
              <tr>
                <td colSpan={3} className="p-3 text-gray-500 text-center">{t('noData')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Activity */}
      <h3 className="text-lg font-semibold mb-4">{t('recentActivity')}</h3>
      <div className="space-y-2">
        {agent.recent_activity.map((act) => (
          <div key={act.id} className="flex items-center gap-3 text-sm">
            <span className="text-gray-500 w-36 shrink-0">
              {new Date(act.created_at).toLocaleString()}
            </span>
            <span className="text-gray-300">{act.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
