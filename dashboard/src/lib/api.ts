import type {
  Project,
  ProjectDetail,
  Agent,
  AgentDetail,
  Task,
  Workflow,
  WorkflowDetail,
  Activity,
  HealthStatus,
  SavedConfig,
  CreateProject,
  CreateAgent,
  CreateTask,
} from '../types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Projects
  getProjects: () => request<{ data: Project[]; total: number }>('/projects'),
  getProject: (id: string) => request<ProjectDetail>(`/projects/${id}`),
  createProject: (data: CreateProject) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: (id: string) =>
    request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),

  // Agents
  getAllAgents: () => request<{ data: Agent[]; total: number }>('/agents'),
  getProjectAgents: (projectId: string) =>
    request<{ data: Agent[]; total: number }>(`/projects/${projectId}/agents`),
  getAgent: (id: string) => request<AgentDetail>(`/agents/${id}`),
  createAgent: (projectId: string, data: CreateAgent) =>
    request<Agent>(`/projects/${projectId}/agents`, { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: string, data: Partial<Agent>) =>
    request<Agent>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAgent: (id: string) =>
    request<{ success: boolean }>(`/agents/${id}`, { method: 'DELETE' }),
  cloneAgent: (id: string, data?: Partial<Agent>) =>
    request<Agent>(`/agents/${id}/clone`, { method: 'POST', body: JSON.stringify(data ?? {}) }),

  // Tasks
  getTasks: (params?: { project_id?: string; agent_id?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ data: Task[]; total: number }>(`/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask: (data: CreateTask) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  executeTask: (id: string) =>
    request<{ message: string; taskId: string; queued: boolean }>(`/tasks/${id}/execute`, {
      method: 'POST',
    }),

  // Workflows
  getWorkflows: (projectId?: string) => {
    const qs = projectId ? `?project_id=${projectId}` : '';
    return request<{ data: Workflow[]; total: number }>(`/workflows${qs}`);
  },
  getWorkflow: (id: string) => request<WorkflowDetail>(`/workflows/${id}`),

  // Activity
  getActivity: (params?: { project_id?: string; agent_id?: string; limit?: number }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ data: Activity[]; total: number }>(`/activity${qs ? `?${qs}` : ''}`);
  },

  // Health
  getHealth: () => request<HealthStatus>('/health'),

  // Saved Configs
  getSavedConfigs: () => request<{ data: SavedConfig[]; total: number }>('/saved-configs'),
};
