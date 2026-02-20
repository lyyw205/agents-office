import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/index.js';
import { projects, agents, agent_communications, activity_log } from '../db/schema.js';
import { broadcast } from '../sse/broadcast.js';

const __filename_hooks = fileURLToPath(import.meta.url);
const __dirname_hooks = dirname(__filename_hooks);
const masterConfigPath = resolve(__dirname_hooks, '../../seed-data/master-config.json');
let agentAliases: Record<string, string> = {};
try {
  const masterCfg = JSON.parse(readFileSync(masterConfigPath, 'utf-8'));
  agentAliases = masterCfg.agentAliases ?? {};
} catch {
  // Config not found - no aliases
}

export const hookRoutes = new Hono();

// ---------------------------------------------------------------------------
// Session tracking (in-memory)
// ---------------------------------------------------------------------------
interface ActiveSession {
  projectId: string;
  lastSeen: number;
}

const activeSessions = new Map<string, ActiveSession>();

const SESSION_TIMEOUT_MS = 5 * 60_000; // 5 minutes
const SESSION_CHECK_INTERVAL_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findProjectByCwd(cwd: string) {
  const allProjects = db.select().from(projects).all();
  // Exact match or startsWith (for subdirectory work)
  return allProjects.find(
    (p) => p.cwd && (cwd === p.cwd || cwd.startsWith(p.cwd + '/'))
  );
}

function updateAgentStatuses(projectId: string, status: 'working' | 'idle') {
  const now = new Date().toISOString();
  db.update(agents)
    .set({ status, updated_at: now })
    .where(eq(agents.project_id, projectId))
    .run();

  // Broadcast each updated agent
  const updated = db
    .select()
    .from(agents)
    .where(eq(agents.project_id, projectId))
    .all();

  for (const agent of updated) {
    broadcast('agent_status', JSON.stringify(agent));
  }
}

function logActivity(projectId: string, action: string, details: Record<string, unknown>) {
  db.insert(activity_log)
    .values({
      id: nanoid(),
      project_id: projectId,
      action,
      details_json: JSON.stringify(details),
    })
    .run();
  broadcast('hook_activity', JSON.stringify({ project_id: projectId, action, ...details }));
}

// ---------------------------------------------------------------------------
// POST / - Receive hook events
// ---------------------------------------------------------------------------
function resolveAgentId(projectId: string, rawName: string): string | null {
  const personaId = agentAliases[rawName] ?? rawName;
  const allAgents = db.select().from(agents).where(eq(agents.project_id, projectId)).all();
  const lower = rawName.toLowerCase();

  for (const a of allAgents) {
    // Match by original_id (static alias -> persona mapping)
    if (a.config_json) {
      try {
        const cfg = JSON.parse(a.config_json) as { original_id?: string; display_alias?: string };
        if (cfg.original_id === personaId) return a.id;
        // Match by display_alias (bidirectional: custom name -> agent)
        if (cfg.display_alias && cfg.display_alias.toLowerCase() === lower) return a.id;
      } catch { /* skip */ }
    }
    // Match by agent name directly
    if (a.name.toLowerCase() === lower) return a.id;
  }

  return null;
}

const sessionEventSchema = z.object({
  event: z.enum(['session_start', 'session_end']),
  cwd: z.string().min(1),
  session_id: z.string().min(1),
});

const toolActivitySchema = z.object({
  event: z.literal('tool_activity'),
  cwd: z.string().min(1),
  session_id: z.string().min(1),
  tool_name: z.string(),
  activity_type: z.enum(['agent_message', 'agent_spawn', 'task_create', 'task_update']),
  summary: z.string(),
  details: z.record(z.unknown()).optional(),
});

const hookEventSchema = z.union([sessionEventSchema, toolActivitySchema]);

hookRoutes.post('/activity', async (c) => {
  const body = await c.req.json();
  const parsed = hookEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', details: parsed.error.errors }, 400);
  }

  const { event, cwd, session_id } = parsed.data;

  const project = findProjectByCwd(cwd);
  if (!project) {
    console.log(`[hooks] No project matched for cwd: ${cwd}`);
    return c.json({ matched: false });
  }

  console.log(`[hooks] ${event} from ${cwd} (project: ${project.name}, session: ${session_id})`);

  if (event === 'session_start') {
    activeSessions.set(session_id, {
      projectId: project.id,
      lastSeen: Date.now(),
    });
    updateAgentStatuses(project.id, 'working');
    logActivity(project.id, 'hook_session_start', { cwd, session_id });
  } else if (event === 'session_end') {
    activeSessions.delete(session_id);

    // Only set idle if no other active sessions for this project
    const hasOtherSessions = [...activeSessions.values()].some(
      (s) => s.projectId === project.id
    );
    if (!hasOtherSessions) {
      updateAgentStatuses(project.id, 'idle');
    }
    logActivity(project.id, 'hook_session_end', { cwd, session_id });
  } else if (event === 'tool_activity') {
    const { tool_name, activity_type, summary, details } = parsed.data as z.infer<typeof toolActivitySchema>;

    // Update session lastSeen
    const existingSession = activeSessions.get(session_id);
    if (existingSession) {
      existingSession.lastSeen = Date.now();
    }

    // Resolve agent IDs from raw names
    const senderRaw = (details?.sender_raw_name as string) ?? null;
    const recipientRaw = (details?.recipient_raw_name as string) ?? null;
    const senderAgentId = senderRaw ? resolveAgentId(project.id, senderRaw) : null;
    const recipientAgentId = recipientRaw ? resolveAgentId(project.id, recipientRaw) : null;

    // Insert into agent_communications
    const commId = nanoid();
    db.insert(agent_communications).values({
      id: commId,
      project_id: project.id,
      session_id,
      activity_type,
      sender_raw_name: senderRaw,
      recipient_raw_name: recipientRaw,
      sender_agent_id: senderAgentId,
      recipient_agent_id: recipientAgentId,
      summary,
      details_json: details ? JSON.stringify(details) : null,
      tool_name,
    }).run();

    // Broadcast single unified SSE event
    broadcast('agent_communication', JSON.stringify({
      id: commId,
      project_id: project.id,
      session_id,
      activity_type,
      sender_raw_name: senderRaw,
      recipient_raw_name: recipientRaw,
      sender_agent_id: senderAgentId,
      recipient_agent_id: recipientAgentId,
      summary,
      details_json: details ? JSON.stringify(details) : null,
      tool_name,
      created_at: new Date().toISOString(),
    }));

    // Also log to activity_log
    logActivity(project.id, `tool_${activity_type}`, { session_id, tool_name, summary });

    console.log(`[hooks] tool_activity: ${activity_type} from ${cwd} (${summary})`);
  }

  return c.json({ matched: true, project: project.name, event });
});

// ---------------------------------------------------------------------------
// Session timeout checker
// ---------------------------------------------------------------------------
function checkSessionTimeouts() {
  const now = Date.now();
  const expired: string[] = [];

  for (const [sessionId, session] of activeSessions) {
    if (now - session.lastSeen > SESSION_TIMEOUT_MS) {
      expired.push(sessionId);
    }
  }

  for (const sessionId of expired) {
    const session = activeSessions.get(sessionId);
    if (!session) continue;

    console.log(`[hooks] Session ${sessionId} timed out, cleaning up`);
    activeSessions.delete(sessionId);

    // Only set idle if no other active sessions for this project
    const hasOtherSessions = [...activeSessions.values()].some(
      (s) => s.projectId === session.projectId
    );
    if (!hasOtherSessions) {
      updateAgentStatuses(session.projectId, 'idle');
      logActivity(session.projectId, 'hook_session_timeout', { session_id: sessionId });
    }
  }
}

export function startSessionTimeoutChecker(): ReturnType<typeof setInterval> {
  return setInterval(checkSessionTimeouts, SESSION_CHECK_INTERVAL_MS);
}
