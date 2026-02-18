const DEFAULT_TIMEOUT_MS = parseInt(process.env['TASK_TIMEOUT_MS'] ?? '', 10) || 5 * 60 * 1000;
const SIGKILL_GRACE_MS = 10_000;

interface WatchEntry {
  taskId: string;
  pid: number;
  timer: ReturnType<typeof setTimeout>;
  killTimer?: ReturnType<typeof setTimeout>;
}

export class Watchdog {
  private readonly entries = new Map<string, WatchEntry>();

  start(taskId: string, pid: number, timeout?: number): void {
    this.cancel(taskId); // clear any existing timer for this task

    const ms = timeout ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      this.entries.delete(taskId);
      console.warn(`[watchdog] Task ${taskId} (pid ${pid}) timed out after ${ms}ms — sending SIGTERM`);
      try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }

      const killTimer = setTimeout(() => {
        console.warn(`[watchdog] Task ${taskId} (pid ${pid}) still alive after grace period — sending SIGKILL`);
        try { process.kill(pid, 'SIGKILL'); } catch { /* already dead */ }
      }, SIGKILL_GRACE_MS);

      // Store kill timer so cancelAll can clear it
      const entry = this.entries.get(taskId);
      if (entry) entry.killTimer = killTimer;
    }, ms);

    this.entries.set(taskId, { taskId, pid, timer });
  }

  cancel(taskId: string): void {
    const entry = this.entries.get(taskId);
    if (!entry) return;
    clearTimeout(entry.timer);
    if (entry.killTimer) clearTimeout(entry.killTimer);
    this.entries.delete(taskId);
  }

  cancelAll(): void {
    for (const taskId of this.entries.keys()) {
      this.cancel(taskId);
    }
  }
}
