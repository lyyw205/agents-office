import { createHash } from 'crypto';
import { readFileSync, readdirSync, statSync, realpathSync, existsSync } from 'fs';
import { homedir } from 'os';
import { resolve, join } from 'path';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { projects, agents, workflows } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DiscoveredProject {
  path: string;
  project_name: string;
  has_team_config: boolean;
  has_persona: boolean;
}

export interface SyncResult {
  project_id: string;
  name: string;
  agents_count: number;
  workflows_count: number;
  status: 'created' | 'updated' | 'unchanged';
}

interface TeamAgentEntry {
  name: string;
  role: string;
  responsibilities: string[];
  modelTier: string;
  priority?: string;
  emoji?: string;
  prompt_template?: string;
}

// ---------------------------------------------------------------------------
// 60-second per-project cooldown
// ---------------------------------------------------------------------------
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 60_000;

// ---------------------------------------------------------------------------
// ProjectSyncService
// ---------------------------------------------------------------------------
export class ProjectSyncService {
  constructor(private readonly allowedPaths: string[]) {}

  // -------------------------------------------------------------------------
  // Discover projects in scan paths (1-level deep)
  // -------------------------------------------------------------------------
  discoverProjects(scanPaths?: string[]): DiscoveredProject[] {
    const paths = scanPaths ?? this.allowedPaths;
    const results: DiscoveredProject[] = [];

    for (const scanPath of paths) {
      const realScanPath = this.resolvePath(scanPath);
      if (!realScanPath || !existsSync(realScanPath)) continue;

      let entries: string[];
      try {
        entries = readdirSync(realScanPath);
      } catch {
        continue;
      }

      for (const entry of entries) {
        const candidatePath = join(realScanPath, entry);
        try {
          if (!statSync(candidatePath).isDirectory()) continue;
        } catch {
          continue;
        }

        const validatedPath = this.validatePath(candidatePath);
        if (!validatedPath) continue;

        const hasTeamConfig = existsSync(join(validatedPath, 'team-config.json'));
        const hasPersona = existsSync(join(validatedPath, 'agents-persona.json'));

        if (hasTeamConfig && hasPersona) {
          // Read project name from team-config.json
          let projectName = entry;
          try {
            const tc = JSON.parse(readFileSync(join(validatedPath, 'team-config.json'), 'utf-8'));
            projectName = tc.projectName ?? entry;
          } catch {
            // use directory name as fallback
          }

          results.push({
            path: validatedPath,
            project_name: projectName,
            has_team_config: hasTeamConfig,
            has_persona: hasPersona,
          });
        }
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Sync a single project by resolved path
  // -------------------------------------------------------------------------
  syncProject(projectPath: string): SyncResult {
    const realPath = this.validatePath(projectPath);
    if (!realPath) throw new Error(`Path not allowed: ${projectPath}`);

    // Cooldown check
    const lastSync = cooldowns.get(realPath);
    if (lastSync && Date.now() - lastSync < COOLDOWN_MS) {
      const existing = db.select().from(projects).where(eq(projects.cwd, realPath)).get();
      return {
        project_id: existing?.id ?? '',
        name: existing?.name ?? '',
        agents_count: 0,
        workflows_count: 0,
        status: 'unchanged',
      };
    }

    // Read config files
    const teamConfigPath = join(realPath, 'team-config.json');
    const personaPath = join(realPath, 'agents-persona.json');

    if (!existsSync(teamConfigPath)) {
      throw new Error(`team-config.json not found in ${realPath}`);
    }

    const teamConfigRaw = readFileSync(teamConfigPath, 'utf-8');
    const teamConfig = JSON.parse(teamConfigRaw);

    if (!teamConfig.projectName || typeof teamConfig.projectName !== 'string') {
      throw new Error(`team-config.json missing required 'projectName' field in ${realPath}`);
    }

    let personaRaw = '{"agents":[]}';
    let personaConfig: { agents: Array<Record<string, unknown>> } = { agents: [] };
    if (existsSync(personaPath)) {
      personaRaw = readFileSync(personaPath, 'utf-8');
      personaConfig = JSON.parse(personaRaw);
    }

    // Hash check for change detection
    const hash = this.computeHash(teamConfigRaw, personaRaw);

    // Check if project exists and hash matches
    const existingProject = db.select().from(projects)
      .where(eq(projects.name, teamConfig.projectName))
      .get();

    if (existingProject?.sync_hash === hash) {
      cooldowns.set(realPath, Date.now());
      return {
        project_id: existingProject.id,
        name: existingProject.name,
        agents_count: 0,
        workflows_count: 0,
        status: 'unchanged',
      };
    }

    const now = new Date().toISOString();
    const isNew = !existingProject;

    // --- Upsert project ---
    db.insert(projects).values({
      id: nanoid(),
      name: teamConfig.projectName,
      display_name: teamConfig.projectName,
      description: teamConfig.description ?? null,
      status: 'active',
      priority: 'medium',
      cwd: realPath,
      source: 'synced',
      sync_hash: hash,
      last_synced_at: now,
    }).onConflictDoUpdate({
      target: projects.name,
      set: {
        description: teamConfig.description ?? null,
        cwd: realPath,
        source: 'synced',
        sync_hash: hash,
        last_synced_at: now,
        status: 'active',
        updated_at: now,
      },
    }).run();

    const project = db.select().from(projects)
      .where(eq(projects.name, teamConfig.projectName))
      .get()!;

    // --- Build team agent lookup ---
    const allTeamAgents: (TeamAgentEntry & { _type: 'pm' | 'core' | 'support' })[] = [
      ...(teamConfig.teamAgents?.pm ?? []).map((a: TeamAgentEntry) => ({ ...a, _type: 'pm' as const })),
      ...(teamConfig.teamAgents?.core ?? []).map((a: TeamAgentEntry) => ({ ...a, _type: 'core' as const })),
      ...(teamConfig.teamAgents?.support ?? []).map((a: TeamAgentEntry) => ({ ...a, _type: 'support' as const })),
    ];
    const teamAgentMap = new Map(allTeamAgents.map(a => [a.name, a]));

    // --- Upsert agents ---
    const syncedAgentNames = new Set<string>();
    let agentsCount = 0;

    for (const persona of personaConfig.agents) {
      const personaId = persona.id as string;
      const personaName = persona.name as string;
      const teamEntry = teamAgentMap.get(personaId);
      const agentType = teamEntry?._type ?? 'support';

      const personaJson = {
        personality: persona.personality,
        backstory: persona.backstory,
        stats: persona.stats,
        office: persona.office,
        specialties: persona.specialties,
      };

      db.insert(agents).values({
        id: nanoid(),
        project_id: project.id,
        name: personaName,
        agent_type: agentType,
        role: (teamEntry?.role ?? persona.role) as string,
        department: (persona.department as string) ?? null,
        status: 'inactive',
        model_tier: teamEntry?.modelTier ?? 'medium',
        emoji: (teamEntry?.emoji ?? persona.emoji) as string ?? null,
        persona_json: JSON.stringify(personaJson),
        skills_json: JSON.stringify(persona.skills),
        config_json: JSON.stringify({
          original_id: personaId,
          responsibilities: teamEntry?.responsibilities ?? persona.specialties,
          priority: teamEntry?.priority ?? 'medium',
        }),
        sprite_key: personaId,
      }).onConflictDoUpdate({
        target: [agents.project_id, agents.name],
        set: {
          agent_type: agentType,
          role: (teamEntry?.role ?? persona.role) as string,
          department: (persona.department as string) ?? null,
          model_tier: teamEntry?.modelTier ?? 'medium',
          emoji: (teamEntry?.emoji ?? persona.emoji) as string ?? null,
          persona_json: JSON.stringify(personaJson),
          skills_json: JSON.stringify(persona.skills),
          config_json: JSON.stringify({
            original_id: personaId,
            responsibilities: teamEntry?.responsibilities ?? persona.specialties,
            priority: teamEntry?.priority ?? 'medium',
          }),
          sprite_key: personaId,
          status: 'inactive',
          updated_at: now,
        },
      }).run();

      syncedAgentNames.add(personaName);
      agentsCount++;
    }

    // Mark removed agents as inactive
    if (syncedAgentNames.size > 0) {
      const projectAgents = db.select().from(agents)
        .where(eq(agents.project_id, project.id))
        .all();
      for (const a of projectAgents) {
        if (!syncedAgentNames.has(a.name) && a.status !== 'inactive') {
          db.update(agents)
            .set({ status: 'inactive', updated_at: now })
            .where(eq(agents.id, a.id))
            .run();
        }
      }
    }

    // --- Upsert workflows ---
    let workflowsCount = 0;
    const teamWorkflows = teamConfig.workflows ?? [];
    for (const wf of teamWorkflows) {
      db.insert(workflows).values({
        id: nanoid(),
        project_id: project.id,
        name: wf.name,
        description: wf.description ?? null,
        steps_json: JSON.stringify(wf.steps),
        estimated_time: wf.estimatedTime ?? null,
        status: 'idle',
        current_step: 0,
      }).onConflictDoUpdate({
        target: [workflows.project_id, workflows.name],
        set: {
          description: wf.description ?? null,
          steps_json: JSON.stringify(wf.steps),
          estimated_time: wf.estimatedTime ?? null,
        },
      }).run();
      workflowsCount++;
    }

    cooldowns.set(realPath, Date.now());

    return {
      project_id: project.id,
      name: teamConfig.projectName,
      agents_count: agentsCount,
      workflows_count: workflowsCount,
      status: isNew ? 'created' : 'updated',
    };
  }

  // -------------------------------------------------------------------------
  // Discover + sync all, archive stale projects
  // -------------------------------------------------------------------------
  syncAll(scanPaths?: string[]): SyncResult[] {
    const discovered = this.discoverProjects(scanPaths);
    const discoveredPaths = new Set(discovered.map(d => d.path));

    const results: SyncResult[] = [];
    for (const d of discovered) {
      if (d.has_team_config && d.has_persona) {
        try {
          results.push(this.syncProject(d.path));
        } catch (err) {
          console.warn(`[sync] Failed to sync ${d.path}:`, err);
        }
      }
    }

    // Archive stale synced projects
    const syncedProjects = db.select().from(projects)
      .where(eq(projects.source, 'synced'))
      .all();
    for (const p of syncedProjects) {
      if (p.cwd && !discoveredPaths.has(p.cwd)) {
        db.update(projects)
          .set({ status: 'archived', updated_at: new Date().toISOString() })
          .where(eq(projects.id, p.id))
          .run();
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Hash both config files for change detection
  // -------------------------------------------------------------------------
  private computeHash(teamConfigContent: string, personaContent: string): string {
    const combined = JSON.stringify({ team: teamConfigContent, persona: personaContent });
    return createHash('sha256').update(combined).digest('hex');
  }

  // -------------------------------------------------------------------------
  // Path security: realpathSync + allowlist check
  // -------------------------------------------------------------------------
  validatePath(candidatePath: string): string | null {
    try {
      const realPath = realpathSync(candidatePath);
      const allowed = this.allowedPaths.some(ap => {
        try {
          const realAllowed = realpathSync(ap);
          return realPath.startsWith(realAllowed + '/') || realPath === realAllowed;
        } catch {
          return false;
        }
      });
      return allowed ? realPath : null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Resolve a path (expand ~ to homedir)
  // -------------------------------------------------------------------------
  private resolvePath(p: string): string | null {
    try {
      const expanded = p.startsWith('~')
        ? join(homedir(), p.slice(1))
        : p;
      return resolve(expanded);
    } catch {
      return null;
    }
  }
}
