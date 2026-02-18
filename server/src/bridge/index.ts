import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tasks, agents, activity_log } from '../db/schema.js';
import { broadcast } from '../sse/broadcast.js';
import { ProcessPool } from './process-pool.js';

export interface BridgeStatus {
  active: string[];
  queueLength: number;
}

class AgentBridge {
  private readonly pool = new ProcessPool();

  async executeTask(taskId: string): Promise<{ queued: boolean; position: number }> {
    const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!task) throw new Error(`Task ${taskId} not found`);

    const agentId = task.agent_id;

    // Build prompt from task fields
    const prompt = [
      task.title,
      task.description ? `\n${task.description}` : '',
      task.input_json ? `\nInput context:\n${task.input_json}` : '',
    ].join('');

    // Resolve model tier from agent if available
    let modelTier = 'medium';
    if (agentId) {
      const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
      if (agent?.model_tier) modelTier = agent.model_tier;
    }

    const result = this.pool.spawn(taskId, {
      prompt,
      modelTier,
      onData: (chunk) => {
        broadcast('task_progress', JSON.stringify({ taskId, agentId, chunk }));
      },
      onComplete: (output) => {
        const now = new Date().toISOString();
        db.update(tasks)
          .set({ status: 'completed', output_json: JSON.stringify({ output }), completed_at: now })
          .where(eq(tasks.id, taskId))
          .run();

        if (agentId) {
          db.update(agents)
            .set({ status: 'idle', updated_at: now })
            .where(eq(agents.id, agentId))
            .run();
        }

        db.insert(activity_log)
          .values({
            id: nanoid(),
            agent_id: agentId,
            project_id: task.project_id,
            task_id: taskId,
            action: 'task_completed',
            details_json: JSON.stringify({ output: output.slice(0, 500) }),
          })
          .run();

        broadcast('task_completed', JSON.stringify({ taskId, agentId, output }));
        if (agentId) {
          broadcast('agent_status', JSON.stringify({ agentId, status: 'idle', taskId }));
        }
      },
      onError: (err) => {
        const now = new Date().toISOString();
        db.update(tasks)
          .set({ status: 'failed', error_json: JSON.stringify({ error: err.message }), completed_at: now })
          .where(eq(tasks.id, taskId))
          .run();

        if (agentId) {
          db.update(agents)
            .set({ status: 'failed', updated_at: now })
            .where(eq(agents.id, agentId))
            .run();
        }

        db.insert(activity_log)
          .values({
            id: nanoid(),
            agent_id: agentId,
            project_id: task.project_id,
            task_id: taskId,
            action: 'task_failed',
            details_json: JSON.stringify({ error: err.message }),
          })
          .run();

        broadcast('task_failed', JSON.stringify({ taskId, agentId, error: err.message }));
        if (agentId) {
          broadcast('agent_status', JSON.stringify({ agentId, status: 'failed', taskId }));
        }
      },
      onTimeout: () => {
        const now = new Date().toISOString();
        const msg = 'Task timed out';
        db.update(tasks)
          .set({ status: 'failed', error_json: JSON.stringify({ error: msg }), completed_at: now })
          .where(eq(tasks.id, taskId))
          .run();

        if (agentId) {
          db.update(agents)
            .set({ status: 'failed', updated_at: now })
            .where(eq(agents.id, agentId))
            .run();
        }

        db.insert(activity_log)
          .values({
            id: nanoid(),
            agent_id: agentId,
            project_id: task.project_id,
            task_id: taskId,
            action: 'task_timeout',
            details_json: JSON.stringify({ error: msg }),
          })
          .run();

        broadcast('task_failed', JSON.stringify({ taskId, agentId, error: msg }));
        if (agentId) {
          broadcast('agent_status', JSON.stringify({ agentId, status: 'failed', taskId }));
        }
      },
    });

    return result;
  }

  cancelTask(taskId: string): void {
    this.pool.cancel(taskId);
  }

  getStatus(): BridgeStatus {
    return {
      active: this.pool.getActive(),
      queueLength: this.pool.getQueueLength(),
    };
  }

  shutdown(): void {
    this.pool.cancelAll();
  }
}

// Singleton
export const bridge = new AgentBridge();

// Named exports for dynamic-import callers (health check, graceful shutdown)
export function getStatus(): { activeProcesses: number; queueLength: number; maxConcurrent: number } {
  const status = bridge.getStatus();
  return {
    activeProcesses: status.active.length,
    queueLength: status.queueLength,
    maxConcurrent: parseInt(process.env['MAX_CONCURRENT_AGENTS'] ?? '', 10) || 3,
  };
}

export function cleanup(): void {
  bridge.shutdown();
}
