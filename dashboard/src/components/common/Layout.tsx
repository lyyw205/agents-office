import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSSE } from '../../hooks/useSSE';
import { useAppStore } from '../../store';

export function Layout() {
  const { t, i18n } = useTranslation();
  const { connected } = useSSE();
  const { locale, setLocale } = useAppStore();

  const toggleLocale = () => {
    const next = locale === 'ko' ? 'en' : 'ko';
    setLocale(next);
    i18n.changeLanguage(next);
  };

  const navItems = [
    { to: '/', label: t('dashboard'), icon: '🏠' },
    { to: '/tasks', label: t('tasks'), icon: '📋' },
    { to: '/workflows', label: t('workflows'), icon: '🔄' },
    { to: '/activity', label: t('activity'), icon: '📊' },
  ];

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold">Agents Office</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">{connected ? t('connected') : t('disconnected')}</span>
          </div>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <button onClick={toggleLocale} className="text-xs text-gray-500 hover:text-gray-300">
            {locale === 'ko' ? 'English' : '한국어'}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
