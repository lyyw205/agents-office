import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export interface ClaudeCLIOptions {
  prompt: string;
  modelTier: string;
  cwd?: string;
  timeout?: number;
}

export interface ClaudeCLIEmitter extends EventEmitter {
  on(event: 'data', listener: (chunk: string) => void): this;
  on(event: 'complete', listener: (output: string) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'timeout', listener: () => void): this;
}

function resolveModel(tier: string): string {
  switch (tier) {
    case 'high':
      return 'claude-opus-4-6';
    case 'low':
      return 'claude-haiku-4-5';
    default:
      return 'claude-sonnet-4-6';
  }
}

export function spawnClaudeCLI(options: ClaudeCLIOptions): { emitter: ClaudeCLIEmitter; pid: number | undefined; kill: () => void } {
  const emitter = new EventEmitter() as ClaudeCLIEmitter;
  const model = resolveModel(options.modelTier);

  const args = [
    '--print',
    '--output-format', 'json',
    '--max-turns', '25',
    '--model', model,
    '-p', options.prompt,
  ];

  const proc = spawn('claude', args, {
    cwd: options.cwd ?? process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  let timedOut = false;

  const timeoutMs = options.timeout ?? 5 * 60 * 1000;
  const timer = setTimeout(() => {
    timedOut = true;
    emitter.emit('timeout');
    proc.kill('SIGTERM');
    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* already dead */ }
    }, 10_000);
  }, timeoutMs);

  proc.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    emitter.emit('data', text);
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  proc.on('error', (err: NodeJS.ErrnoException) => {
    clearTimeout(timer);
    if (err.code === 'ENOENT') {
      emitter.emit('error', new Error('claude CLI not found. Please install it with: npm install -g @anthropic-ai/claude-code'));
    } else {
      emitter.emit('error', err);
    }
  });

  proc.on('close', (code) => {
    clearTimeout(timer);
    if (timedOut) return; // timeout event already emitted

    if (code === 0) {
      emitter.emit('complete', stdout);
    } else {
      emitter.emit('error', new Error(`claude CLI exited with code ${code}${stderr ? ': ' + stderr.trim() : ''}`));
    }
  });

  return {
    emitter,
    pid: proc.pid,
    kill: () => {
      clearTimeout(timer);
      try { proc.kill('SIGTERM'); } catch { /* already dead */ }
    },
  };
}
