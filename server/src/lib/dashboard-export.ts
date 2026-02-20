/**
 * Auto-export dashboard customizations to seed-data so they survive git push/pull.
 * Writes JSON files that seed.ts reads on fresh DB initialization.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename_export = fileURLToPath(import.meta.url);
const __dirname_export = dirname(__filename_export);
const SEED_DIR = resolve(__dirname_export, '../../seed-data');

const SCENE_CONFIG_PATH = resolve(SEED_DIR, 'scene-config.json');
const AGENT_OVERRIDES_PATH = resolve(SEED_DIR, 'agent-overrides.json');

// ---------------------------------------------------------------------------
// Scene config export (office tilemap, zones, deskMap)
// ---------------------------------------------------------------------------

interface SceneConfigStore {
  [projectName: string]: unknown;
}

export function exportSceneConfig(projectName: string, sceneConfig: string | null): void {
  try {
    const store: SceneConfigStore = existsSync(SCENE_CONFIG_PATH)
      ? JSON.parse(readFileSync(SCENE_CONFIG_PATH, 'utf-8'))
      : {};

    if (sceneConfig) {
      store[projectName] = JSON.parse(sceneConfig);
    } else {
      delete store[projectName];
    }

    writeFileSync(SCENE_CONFIG_PATH, JSON.stringify(store, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.warn('[export] Failed to export scene config:', err);
  }
}

export function loadSceneConfig(projectName: string): string | null {
  try {
    if (!existsSync(SCENE_CONFIG_PATH)) return null;
    const store: SceneConfigStore = JSON.parse(readFileSync(SCENE_CONFIG_PATH, 'utf-8'));
    const data = store[projectName];
    return data ? JSON.stringify(data) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Agent overrides export (display_alias, desk, name, role, department, emoji)
// ---------------------------------------------------------------------------

interface AgentOverride {
  name?: string;
  role?: string;
  department?: string | null;
  emoji?: string | null;
  display_alias?: string;
  desk?: string;
}

interface AgentOverridesStore {
  [projectName: string]: {
    [agentOriginalId: string]: AgentOverride;
  };
}

export function exportAgentOverride(
  projectName: string,
  originalId: string,
  override: AgentOverride,
): void {
  try {
    const store: AgentOverridesStore = existsSync(AGENT_OVERRIDES_PATH)
      ? JSON.parse(readFileSync(AGENT_OVERRIDES_PATH, 'utf-8'))
      : {};

    if (!store[projectName]) store[projectName] = {};
    store[projectName][originalId] = override;

    writeFileSync(AGENT_OVERRIDES_PATH, JSON.stringify(store, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.warn('[export] Failed to export agent override:', err);
  }
}

export function loadAgentOverrides(projectName: string): Record<string, AgentOverride> {
  try {
    if (!existsSync(AGENT_OVERRIDES_PATH)) return {};
    const store: AgentOverridesStore = JSON.parse(readFileSync(AGENT_OVERRIDES_PATH, 'utf-8'));
    return store[projectName] ?? {};
  } catch {
    return {};
  }
}
