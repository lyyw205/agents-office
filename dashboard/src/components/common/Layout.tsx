import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSSE } from '../../hooks/useSSE';
import { useAppStore } from '../../store';
import type { RealtimeComm } from '../../hooks/useSSE';

export interface LayoutContext {
  communications: RealtimeComm[];
}

export function Layout() {
  const { t, i18n } = useTranslation();
  const { connected, communications } = useSSE();
  const { locale, setLocale } = useAppStore();
  const location = useLocation();

  const toggleLocale = () => {
    const next = locale === 'ko' ? 'en' : 'ko';
    setLocale(next);
    i18n.changeLanguage(next);
  };

  const isHome = location.pathname === '/';

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          {!isHome && (
            <Link to="/" className="text-gray-400 hover:text-gray-200 text-sm">&larr;</Link>
          )}
          <h1 className="text-lg font-bold">
            <Link to="/" className="hover:text-white transition-colors">Agents Office</Link>
          </h1>
          <div className="flex items-center gap-1.5 ml-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-500">{connected ? t('connected') : t('disconnected')}</span>
          </div>
        </div>
        <button onClick={toggleLocale} className="text-xs text-gray-500 hover:text-gray-300">
          {locale === 'ko' ? 'English' : '한국어'}
        </button>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet context={{ communications } satisfies LayoutContext} />
      </main>
    </div>
  );
}
