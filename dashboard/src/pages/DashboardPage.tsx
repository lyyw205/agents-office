import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { PhaserOffice } from '../components/phaser/PhaserOffice';
import type { Project, Agent } from '../types';
import type { SceneConfig } from '../types/tilemap';
import type { LayoutContext } from '../components/common/Layout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function parseJson<T = Record<string, unknown>>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

const agentStatusColors: Record<string, string> = {
  inactive: 'bg-gray-500',
  idle: 'bg-green-500',
  working: 'bg-yellow-500',
  completed: 'bg-blue-500',
  failed: 'bg-red-500',
};

const agentStatusLabels: Record<string, string> = {
  inactive: 'Offline',
  idle: 'Idle',
  working: 'Working',
  completed: 'Done',
  failed: 'Error',
};

const taskStatusColors: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
  blocked: 'bg-orange-500/20 text-orange-400',
};

const activityTypeIcons: Record<string, string> = {
  agent_message: '\u{1F4AC}',
  agent_spawn: '\u{1F680}',
  task_create: '\u{1F4CB}',
  task_update: '\u{270F}\u{FE0F}',
};

const activityTypeColors: Record<string, string> = {
  agent_message: 'border-l-sky-400',
  agent_spawn: 'border-l-green-400',
  task_create: 'border-l-amber-400',
  task_update: 'border-l-violet-400',
};

// ---------------------------------------------------------------------------
// Agent Card (clickable, not a link)
// ---------------------------------------------------------------------------

function AgentCard({ agent, selected, onClick }: { agent: Agent; selected: boolean; onClick: () => void }) {
  const config = parseJson<{ display_alias?: string }>(agent.config_json);
  const alias = config?.display_alias;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 bg-gray-900/60 rounded-lg p-3 border transition-colors group ${
        selected ? 'border-blue-500/50 bg-blue-500/5' : 'border-gray-800/50 hover:border-gray-700'
      }`}
    >
      <span className="text-lg shrink-0">{agent.emoji || '\u{1F916}'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-white transition-colors">
          {alias || agent.name}
        </p>
        <p className="text-[11px] text-gray-500 truncate">{agent.role}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-gray-500">{agentStatusLabels[agent.status] ?? agent.status}</span>
        <span className={`w-2 h-2 rounded-full ${agentStatusColors[agent.status] ?? 'bg-gray-500'}`} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Agent Detail Panel (sidebar with edit)
// ---------------------------------------------------------------------------

interface AgentConfig {
  original_id?: string;
  responsibilities?: string[];
  priority?: string;
  display_alias?: string;
}

interface AgentPersona {
  personality?: string;
  backstory?: string;
  stats?: Record<string, number>;
  office?: { desk?: string };
  specialties?: string[];
}

function AgentDetailPanel({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editAlias, setEditAlias] = useState('');

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agents', agentId],
    queryFn: () => api.getAgent(agentId),
  });

  const config = useMemo(() => parseJson<AgentConfig>(agent?.config_json ?? null) ?? {}, [agent?.config_json]);
  const persona = useMemo(() => parseJson<AgentPersona>(agent?.persona_json ?? null) ?? {}, [agent?.persona_json]);
  const skills = useMemo(() => {
    const raw = parseJson<Array<{ name: string }>>(agent?.skills_json ?? null);
    return raw?.map((s) => s.name) ?? [];
  }, [agent?.skills_json]);

  // Sync edit fields when entering edit mode or agent changes
  useEffect(() => {
    if (agent) {
      setEditName(agent.name);
      setEditRole(agent.role);
      setEditDept(agent.department ?? '');
      setEditEmoji(agent.emoji ?? '');
      setEditAlias(config.display_alias ?? '');
    }
  }, [agent, config.display_alias]);

  async function handleSave() {
    if (!agent) return;
    setSaving(true);
    try {
      const updatedConfig = { ...config };
      if (editAlias.trim()) {
        updatedConfig.display_alias = editAlias.trim();
      } else {
        delete updatedConfig.display_alias;
      }

      await api.updateAgent(agent.id, {
        name: editName.trim() || agent.name,
        role: editRole.trim() || agent.role,
        department: editDept.trim() || null,
        emoji: editEmoji.trim() || null,
        config_json: JSON.stringify(updatedConfig),
      });

      await queryClient.invalidateQueries({ queryKey: ['agents'] });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save agent:', err);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="p-4 text-gray-400 text-sm">{t('loading')}</div>;
  if (!agent) return <div className="p-4 text-red-400 text-sm">{t('error')}</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{agent.emoji || '\u{1F916}'}</span>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">
              {config.display_alias || agent.name}
            </h3>
            {config.display_alias && (
              <p className="text-[10px] text-gray-500 truncate">{agent.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-2 py-1 text-[11px] rounded border transition-colors ${
              isEditing
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : 'bg-gray-800 text-gray-400 border-gray-700/50 hover:text-white'
            }`}
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">
            &times;
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Status */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800/50">
          <span className={`w-2 h-2 rounded-full ${agentStatusColors[agent.status] ?? 'bg-gray-500'}`} />
          <span className="text-xs text-gray-400">{agentStatusLabels[agent.status] ?? agent.status}</span>
          <span className="text-[10px] text-gray-600 ml-auto">{agent.model_tier} tier</span>
        </div>

        {/* Editable fields */}
        <div className="px-4 py-3 border-b border-gray-800/50 space-y-2.5">
          {isEditing ? (
            <>
              <FieldInput label="Display Alias" value={editAlias} onChange={setEditAlias} placeholder="e.g. Kim Manager" />
              <FieldInput label="Name" value={editName} onChange={setEditName} />
              <FieldInput label="Role" value={editRole} onChange={setEditRole} />
              <FieldInput label="Department" value={editDept} onChange={setEditDept} />
              <FieldInput label="Emoji" value={editEmoji} onChange={setEditEmoji} />
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-2 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              {config.display_alias && (
                <FieldDisplay label="Alias" value={config.display_alias} />
              )}
              <FieldDisplay label="Role" value={agent.role} />
              {agent.department && <FieldDisplay label="Department" value={agent.department} />}
            </>
          )}
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-800/50">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Skills</span>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {skills.map((skill) => (
                <span key={skill} className="px-2 py-0.5 text-[10px] bg-gray-800 text-gray-300 rounded">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Responsibilities */}
        {config.responsibilities && config.responsibilities.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-800/50">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Responsibilities</span>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {config.responsibilities.map((r) => (
                <span key={r} className="px-2 py-0.5 text-[10px] bg-violet-500/10 text-violet-300 rounded">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Persona */}
        {persona.personality && (
          <div className="px-4 py-3 border-b border-gray-800/50">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Personality</span>
            <p className="text-xs text-gray-400 mt-1">{persona.personality}</p>
          </div>
        )}
        {persona.backstory && (
          <div className="px-4 py-3 border-b border-gray-800/50">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Backstory</span>
            <p className="text-xs text-gray-400 mt-1">{persona.backstory}</p>
          </div>
        )}
        {persona.specialties && persona.specialties.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-800/50">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Specialties</span>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {persona.specialties.map((s) => (
                <span key={s} className="px-2 py-0.5 text-[10px] bg-cyan-500/10 text-cyan-300 rounded">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Tasks */}
        {agent.tasks.length > 0 && (
          <div className="px-4 py-3">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Recent Tasks</span>
            <div className="mt-1.5 space-y-1">
              {agent.tasks.slice(0, 6).map((task) => (
                <div key={task.id} className="flex items-center gap-2 py-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${taskStatusColors[task.status] ?? ''}`}>
                    {task.status}
                  </span>
                  <span className="text-[11px] truncate flex-1">{task.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-0.5 px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
      />
    </div>
  );
}

function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</span>
      <p className="text-xs text-gray-300 mt-0.5">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Sidebar
// ---------------------------------------------------------------------------

function ProjectSidebar({ projectId, onClose, onSelectAgent }: {
  projectId: string; onClose: () => void; onSelectAgent: (id: string) => void;
}) {
  const { t } = useTranslation();

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => api.getProject(projectId),
  });

  if (isLoading) return <div className="p-4 text-gray-400 text-sm">{t('loading')}</div>;
  if (!project) return <div className="p-4 text-red-400 text-sm">{t('error')}</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="font-semibold truncate">{project.display_name}</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
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
              <button
                key={agent.id}
                onClick={() => onSelectAgent(agent.id)}
                className="w-full text-left flex items-center gap-2 p-2 rounded hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-sm">{agent.emoji || '\u{1F916}'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{agent.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{agent.role}</p>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 ${agentStatusColors[agent.status] ?? 'bg-gray-500'}`} />
              </button>
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
                  {task.status}
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

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

type SidebarPanel = { type: 'project'; id: string } | { type: 'agent'; id: string } | null;

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { communications } = useOutletContext<LayoutContext>();
  const [panel, setPanel] = useState<SidebarPanel>(null);

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
  const { data: commsData } = useQuery({
    queryKey: ['communications'],
    queryFn: () => api.getCommunications({ limit: 50 }),
  });

  const projects = projectsData?.data ?? [];
  const allAgents = agentsData?.data ?? [];
  const totalAgents = projects.reduce((s, p) => s + (p.agent_count ?? 0), 0);
  const totalTasks = projects.reduce((s, p) => s + (p.task_count ?? 0), 0);
  const workingAgents = allAgents.filter((a) => a.status === 'working').length;

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

  const activityFeed = useMemo(() => {
    const persisted = commsData?.data ?? [];
    const realtimeIds = new Set(communications.map((c) => c.id));
    const merged = [
      ...communications,
      ...persisted.filter((c) => !realtimeIds.has(c.id)),
    ];
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return merged.slice(0, 30);
  }, [commsData, communications]);

  function selectAgent(id: string) {
    setPanel((prev) => prev?.type === 'agent' && prev.id === id ? null : { type: 'agent', id });
  }

  function selectProject(id: string) {
    setPanel((prev) => prev?.type === 'project' && prev.id === id ? null : { type: 'project', id });
  }

  if (isLoading) return <div className="p-8 text-gray-400">{t('loading')}</div>;

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* Stats bar */}
          <div className="flex items-center gap-6">
            {[
              { label: t('totalProjects'), value: projects.length },
              { label: t('totalAgents'), value: totalAgents },
              { label: 'Working', value: workingAgents },
              { label: t('totalTasks'), value: totalTasks },
              { label: t('uptime'), value: healthData ? `${Math.floor(healthData.uptime / 60)}m` : '-' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className="text-xl font-bold">{stat.value}</span>
                <span className="text-xs text-gray-500">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Office View + Agents + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Office View (left, 3 cols) */}
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Office</span>
                {officeProject && (
                  <button
                    onClick={() => navigate(`/projects/${officeProject.id}/editor`)}
                    className="px-2 py-1 text-[11px] bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white rounded border border-gray-700/50 transition-colors"
                  >
                    Customize
                  </button>
                )}
              </div>
              <PhaserOffice
                agents={allAgents}
                sceneConfig={officeSceneConfig}
                communications={communications}
              />
            </div>

            {/* Right panel: Agents + Activity (2 cols) */}
            <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
              {/* Agent Cards */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Agents</h3>
                <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {allAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      selected={panel?.type === 'agent' && panel.id === agent.id}
                      onClick={() => selectAgent(agent.id)}
                    />
                  ))}
                  {allAgents.length === 0 && (
                    <p className="text-gray-500 text-xs">{t('noData')}</p>
                  )}
                </div>
              </div>

              {/* Activity Feed */}
              <div className="flex-1 min-h-0">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Activity Feed</h3>
                <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
                  {activityFeed.length > 0 ? activityFeed.map((comm) => (
                    <div
                      key={comm.id}
                      className={`border-l-2 ${activityTypeColors[comm.activity_type] ?? 'border-l-gray-600'} bg-gray-900/60 rounded-r-lg px-2.5 py-1.5`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px]">{activityTypeIcons[comm.activity_type] ?? '\u{1F4CC}'}</span>
                        <span className="text-[11px] text-gray-200 flex-1 truncate">{comm.summary}</span>
                        <span className="text-[10px] text-gray-600 shrink-0">{timeAgo(comm.created_at)}</span>
                      </div>
                      {comm.sender_raw_name && (
                        <p className="text-[10px] text-gray-500 mt-0.5 ml-5">
                          {comm.sender_raw_name}
                          {comm.recipient_raw_name ? ` \u{2192} ${comm.recipient_raw_name}` : ''}
                        </p>
                      )}
                    </div>
                  )) : (
                    <p className="text-xs text-gray-500 py-3 text-center">No activity yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Projects + Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Projects */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('projects')}</h3>
              <div className="space-y-2">
                {projects.map((project: Project) => (
                  <button
                    key={project.id}
                    onClick={() => selectProject(project.id)}
                    className={`w-full text-left bg-gray-900/60 rounded-lg p-4 border transition-colors ${
                      panel?.type === 'project' && panel.id === project.id
                        ? 'border-blue-500/50 bg-blue-500/5'
                        : 'border-gray-800/50 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm">{project.display_name}</h4>
                      <StatusBadge status={project.status} />
                    </div>
                    {project.description && (
                      <p className="text-xs text-gray-500 line-clamp-1">{project.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>{project.agent_count ?? 0} agents</span>
                      <span>{project.task_count ?? 0} tasks</span>
                      <PriorityBadge priority={project.priority} />
                    </div>
                  </button>
                ))}
                {projects.length === 0 && (
                  <p className="text-gray-500 text-sm">{t('noData')}</p>
                )}
              </div>
            </div>

            {/* Tasks */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('tasks')}</h3>
              <div className="bg-gray-900/60 rounded-lg border border-gray-800/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs">
                      <th className="text-left p-3">Title</th>
                      <th className="text-left p-3">{t('status')}</th>
                      <th className="text-left p-3">{t('priority')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tasksData?.data ?? []).slice(0, 10).map((task) => (
                      <tr key={task.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                        <td className="p-3 truncate max-w-48 text-xs">{task.title}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${taskStatusColors[task.status] ?? ''}`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500 text-xs">{task.priority}</td>
                      </tr>
                    ))}
                    {(tasksData?.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-3 text-gray-500 text-center text-xs">{t('noData')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Right sidebar: Agent or Project detail */}
      {panel && (
        <aside className="w-80 shrink-0 bg-gray-900 border-l border-gray-800 overflow-hidden">
          {panel.type === 'agent' ? (
            <AgentDetailPanel
              agentId={panel.id}
              onClose={() => setPanel(null)}
            />
          ) : (
            <ProjectSidebar
              projectId={panel.id}
              onClose={() => setPanel(null)}
              onSelectAgent={(id) => setPanel({ type: 'agent', id })}
            />
          )}
        </aside>
      )}
    </div>
  );
}
