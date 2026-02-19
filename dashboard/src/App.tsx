import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './i18n';
import { Layout } from './components/common/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectPage } from './pages/ProjectPage';
import { AgentPage } from './pages/AgentPage';
import { TasksPage } from './pages/TasksPage';
import { ActivityPage } from './pages/ActivityPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="projects/:id" element={<ProjectPage />} />
            <Route path="agents/:id" element={<AgentPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="workflows" element={<DashboardPage />} />
            <Route path="activity" element={<ActivityPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <ToastContainer theme="dark" position="bottom-right" />
    </QueryClientProvider>
  );
}
