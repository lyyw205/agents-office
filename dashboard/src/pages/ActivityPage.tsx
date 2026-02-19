import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

export function ActivityPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.getActivity({ limit: 100 }),
  });

  if (isLoading) return <div className="p-8 text-gray-400">{t('loading')}</div>;

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">{t('activity')}</h2>
      <div className="space-y-2">
        {(data?.data ?? []).map((act) => (
          <div key={act.id} className="flex items-start gap-4 bg-gray-900 rounded-lg p-3 border border-gray-800">
            <span className="text-gray-500 text-xs w-40 shrink-0 pt-0.5">
              {new Date(act.created_at).toLocaleString()}
            </span>
            <div>
              <span className="text-sm font-medium text-gray-200">{act.action}</span>
              {act.details_json && (
                <p className="text-xs text-gray-500 mt-0.5">{act.details_json.slice(0, 120)}</p>
              )}
            </div>
          </div>
        ))}
        {(data?.data ?? []).length === 0 && (
          <p className="text-gray-500">{t('noData')}</p>
        )}
      </div>
    </div>
  );
}
