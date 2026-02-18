import { spawnClaudeCLI, type ClaudeCLIOptions } from './claude-cli.js';
import { Watchdog } from './watchdog.js';

const MAX_CONCURRENT = parseInt(process.env['MAX_CONCURRENT_AGENTS'] ?? '', 10) || 3;

export interface SpawnConfig extends ClaudeCLIOptions {
  onData?: (chunk: string) => void;
  onComplete?: (output: string) => void;
  onError?: (err: Error) => void;
  onTimeout?: () => void;
}

interface ActiveEntry {
  taskId: string;
  kill: () => void;
  pid: number | undefined;
}

interface QueueEntry {
  taskId: string;
  config: SpawnConfig;
}

export class ProcessPool {
  private readonly active = new Map<string, ActiveEntry>();
  private readonly queue: QueueEntry[] = [];
  private readonly watchdog = new Watchdog();

  spawn(taskId: string, config: SpawnConfig): { queued: boolean; position: number } {
    if (this.active.has(taskId)) {
      return { queued: false, position: 0 };
    }

    if (this.active.size >= MAX_CONCURRENT) {
      this.queue.push({ taskId, config });
      return { queued: true, position: this.queue.length };
    }

    this._launch(taskId, config);
    return { queued: false, position: 0 };
  }

  cancel(taskId: string): void {
    // Remove from queue if waiting
    const queueIdx = this.queue.findIndex((e) => e.taskId === taskId);
    if (queueIdx !== -1) {
      this.queue.splice(queueIdx, 1);
      return;
    }

    // Kill active process
    const entry = this.active.get(taskId);
    if (entry) {
      this.watchdog.cancel(taskId);
      entry.kill();
      this.active.delete(taskId);
      this._processQueue();
    }
  }

  getActive(): string[] {
    return Array.from(this.active.keys());
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  cancelAll(): void {
    this.queue.length = 0;
    this.watchdog.cancelAll();
    for (const entry of this.active.values()) {
      entry.kill();
    }
    this.active.clear();
  }

  private _launch(taskId: string, config: SpawnConfig): void {
    const { emitter, pid, kill } = spawnClaudeCLI(config);

    this.active.set(taskId, { taskId, kill, pid });

    if (pid !== undefined) {
      this.watchdog.start(taskId, pid, config.timeout);
    }

    emitter.on('data', (chunk) => config.onData?.(chunk));

    emitter.on('complete', (output) => {
      this.watchdog.cancel(taskId);
      this.active.delete(taskId);
      config.onComplete?.(output);
      this._processQueue();
    });

    emitter.on('error', (err) => {
      this.watchdog.cancel(taskId);
      this.active.delete(taskId);
      config.onError?.(err);
      this._processQueue();
    });

    emitter.on('timeout', () => {
      this.watchdog.cancel(taskId);
      this.active.delete(taskId);
      config.onTimeout?.();
      this._processQueue();
    });
  }

  private _processQueue(): void {
    while (this.active.size < MAX_CONCURRENT && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this._launch(next.taskId, next.config);
      }
    }
  }
}
