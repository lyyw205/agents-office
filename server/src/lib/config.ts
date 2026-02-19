import { homedir } from 'os';
import { resolve, join } from 'path';

export function getScanPaths(): string[] {
  const envVal = process.env['SCAN_PATHS'];
  if (envVal) {
    return envVal.split(',').map(s => {
      const trimmed = s.trim();
      const expanded = trimmed.startsWith('~') ? join(homedir(), trimmed.slice(1)) : trimmed;
      return resolve(expanded);
    });
  }
  return [resolve(homedir(), 'repos')];
}
