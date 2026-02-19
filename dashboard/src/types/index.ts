export interface Project {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  status: 'active' | 'archived' | 'completed';
  priority: 'low' | 'medium' | 'high';
  config_json: string | null;
  scene_config: string | null;
  created_at: string;
  updated_at: string;
  agent_count?: number;
  task_count?: number;
}

export interface ProjectDetail extends Project {
  agents: Agent[];
  recent_tasks: Task[];
}

export interface Agent {
  id: string;
  project_id: string | null;
  parent_id: string | null;
  name: string;
  agent_type: 'master' | 'pm' | 'core' | 'support';
  role: string;
  department: string | null;
  status: 'inactive' | 'idle' | 'working' | 'completed' | 'failed';
  model_tier: 'low' | 'medium' | 'high';
  emoji: string | null;
  persona_json: string | null;
  skills_json: string | null;
  config_json: string | null;
  sprite_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentDetail extends Agent {
  tasks: Task[];
  recent_activity: Activity[];
}

export interface Task {
  id: string;
  project_id: string;
  agent_id: string | null;
  workflow_id: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  input_json: string | null;
  output_json: string | null;
  error_json: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Workflow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  steps_json: string;
  estimated_time: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  current_step: number;
  created_at: string;
}

export interface WorkflowDetail extends Workflow {
  steps: unknown;
  tasks: Task[];
}

export interface Activity {
  id: string;
  agent_id: string | null;
  project_id: string | null;
  task_id: string | null;
  action: string;
  details_json: string | null;
  created_at: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
  db: { status: string; path: string; tables: number };
  bridge: { status: string; activeProcesses: number; queueLength: number; maxConcurrent: number };
  sse: { connectedClients: number };
}

export interface SavedConfig {
  id: string;
  name: string;
  description: string | null;
  agent_type: string;
  role: string;
  department: string | null;
  model_tier: string;
  persona_json: string | null;
  skills_json: string | null;
  config_json: string | null;
  source_agent_id: string | null;
  created_at: string;
}

export type CreateProject = { name: string; display_name: string; description?: string; priority?: string };
export type CreateAgent = { name: string; agent_type: string; role: string; department?: string; model_tier?: string; emoji?: string };
export type CreateTask = { project_id: string; title: string; agent_id?: string; description?: string; priority?: string };
