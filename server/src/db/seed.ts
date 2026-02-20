import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from './index.js'; // index.js auto-creates tables on import
import { projects, agents, workflows, activity_log } from './schema.js';
import { sql } from 'drizzle-orm';
import { loadSceneConfig, loadAgentOverrides } from '../lib/dashboard-export.js';

// ---------------------------------------------------------------------------
// JSON file paths (seed data lives in server/seed-data/)
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED_DATA = resolve(__dirname, '../../seed-data');

const masterConfig = JSON.parse(
  readFileSync(resolve(SEED_DATA, 'master-config.json'), 'utf-8')
);

const teamConfig = JSON.parse(
  readFileSync(resolve(SEED_DATA, 'team-config.json'), 'utf-8')
);

const personaConfig = JSON.parse(
  readFileSync(resolve(SEED_DATA, 'agents-persona.json'), 'utf-8')
);

// ---------------------------------------------------------------------------
// Build lookup: team-config agent name -> responsibilities + modelTier
// ---------------------------------------------------------------------------
type TeamAgentEntry = {
  name: string;
  role: string;
  responsibilities: string[];
  modelTier: string;
  priority?: string;
};

const teamAgentMap = new Map<string, TeamAgentEntry>();

const allTeamAgents: TeamAgentEntry[] = [
  ...(teamConfig.teamAgents?.pm ?? []),
  ...(teamConfig.teamAgents?.core ?? []),
  ...(teamConfig.teamAgents?.support ?? []),
];

for (const a of allTeamAgents) {
  teamAgentMap.set(a.name, a);
}

// ---------------------------------------------------------------------------
// Determine agent_type from team-config category
// ---------------------------------------------------------------------------
function resolveAgentType(id: string): 'pm' | 'core' | 'support' | 'master' {
  const pmNames = (teamConfig.teamAgents?.pm ?? []).map((a: TeamAgentEntry) => a.name) as string[];
  const coreNames = (teamConfig.teamAgents?.core ?? []).map((a: TeamAgentEntry) => a.name) as string[];
  if (pmNames.includes(id)) return 'pm';
  if (coreNames.includes(id)) return 'core';
  return 'support';
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------
async function seed() {
  console.log('Seeding database...');

  // -------------------------------------------------------------------------
  // 1. Projects
  // -------------------------------------------------------------------------
  const projectStatusMap: Record<string, string> = {
    'auto-details': 'active',
  };

  const projectDisplayNames: Record<string, string> = {
    'auto-details': 'Auto Details',
  };

  const projectDescriptions: Record<string, string> = {
    'auto-details': teamConfig.description ?? 'AI 기반 상세페이지 자동 제작 시스템',
  };

  const projectRows: (typeof projects.$inferInsert)[] = masterConfig.projects.map(
    (p: { name: string; status: string; priority: string; cwd?: string }) => ({
      id: nanoid(),
      name: p.name,
      display_name: projectDisplayNames[p.name] ?? p.name,
      description: projectDescriptions[p.name] ?? null,
      status: projectStatusMap[p.name] ?? p.status,
      priority: p.priority,
      config_json: null,
      scene_config: null,
      cwd: p.cwd ?? null,
      source: 'seed',
    })
  );

  for (const row of projectRows) {
    // Apply exported scene_config if available
    const exportedScene = loadSceneConfig(row.name);
    if (exportedScene) {
      row.scene_config = exportedScene;
      console.log(`  [seed] Applied exported scene_config for ${row.name}`);
    }
    db.insert(projects).values(row).onConflictDoNothing().run();
  }

  // Backfill: mark existing projects without a source as 'seed'
  db.run(sql`UPDATE projects SET source = 'seed' WHERE source IS NULL`);

  console.log(`Inserted ${projectRows.length} projects`);

  // Resolve auto-details project id for later use
  const autoDetailsProject = db
    .select()
    .from(projects)
    .all()
    .find((p) => p.name === 'auto-details');

  if (!autoDetailsProject) {
    throw new Error('auto-details project not found after insert');
  }

  const autoDetailsId = autoDetailsProject.id;

  // -------------------------------------------------------------------------
  // 2. Master agent (no project_id, no parent)
  // -------------------------------------------------------------------------
  const master = masterConfig.masterAgent;
  const masterRow: typeof agents.$inferInsert = {
    id: nanoid(),
    project_id: null,
    parent_id: null,
    name: master.name,
    agent_type: 'master',
    role: master.role,
    department: null,
    status: master.status === 'active' ? 'idle' : 'inactive',
    model_tier: master.modelTier ?? 'high',
    emoji: '🎯',
    persona_json: JSON.stringify({ office: { desk: 'F2' } }),
    skills_json: null,
    config_json: JSON.stringify({ original_id: master.id }),
    sprite_key: 'master-orchestrator',
  };

  db.insert(agents).values(masterRow).onConflictDoNothing().run();
  console.log('Inserted master agent');

  const masterAgentRow = db.select().from(agents).all().find((a) => a.agent_type === 'master');

  // -------------------------------------------------------------------------
  // 3. PM agent for auto-details
  // -------------------------------------------------------------------------
  const pmDef = teamConfig.hierarchy.pmAgent;
  const pmTeamEntry = teamAgentMap.get(pmDef.id);

  const pmRow: typeof agents.$inferInsert = {
    id: nanoid(),
    project_id: autoDetailsId,
    parent_id: masterAgentRow?.id ?? null,
    name: pmDef.name,
    agent_type: 'pm',
    role: pmDef.role,
    department: 'Management',
    status: 'idle',
    model_tier: pmDef.modelTier ?? 'high',
    emoji: '📋',
    persona_json: JSON.stringify({ office: { desk: 'G1' } }),
    skills_json: pmTeamEntry
      ? JSON.stringify(pmTeamEntry.responsibilities.map((r: string) => ({ name: r })))
      : null,
    config_json: JSON.stringify({
      original_id: pmDef.id,
      responsibilities: pmDef.responsibilities,
    }),
    sprite_key: 'pm',
  };

  db.insert(agents).values(pmRow).onConflictDoNothing().run();
  console.log('Inserted PM agent');

  const pmAgentRow = db.select().from(agents).all().find((a) => a.agent_type === 'pm');

  // -------------------------------------------------------------------------
  // 4. Team agents from agents-persona.json
  // -------------------------------------------------------------------------
  const personaAgents: Array<{
    id: string;
    name: string;
    emoji: string;
    role: string;
    department: string;
    personality: object;
    skills: Array<{ name: string; level: number; category: string }>;
    specialties: string[];
    backstory: string;
    stats: object;
    office: { desk: string; floor: number; preferredWorkTime: string };
  }> = personaConfig.agents;

  let agentInsertCount = 0;

  for (const persona of personaAgents) {
    const teamEntry = teamAgentMap.get(persona.id);
    const agentType = resolveAgentType(persona.id);

    const personaJson = {
      personality: persona.personality,
      backstory: persona.backstory,
      stats: persona.stats,
      office: persona.office,
      specialties: persona.specialties,
    };

    const row: typeof agents.$inferInsert = {
      id: nanoid(),
      project_id: autoDetailsId,
      parent_id: pmAgentRow?.id ?? null,
      name: persona.name,
      agent_type: agentType,
      role: teamEntry?.role ?? persona.role,
      department: persona.department,
      status: 'inactive',
      model_tier: teamEntry?.modelTier ?? 'medium',
      emoji: persona.emoji,
      persona_json: JSON.stringify(personaJson),
      skills_json: JSON.stringify(persona.skills),
      config_json: JSON.stringify({
        original_id: persona.id,
        responsibilities: teamEntry?.responsibilities ?? persona.specialties,
        priority: teamEntry?.priority ?? 'medium',
      }),
      sprite_key: persona.id,
    };

    db.insert(agents).values(row).onConflictDoNothing().run();
    agentInsertCount++;
  }

  console.log(`Inserted ${agentInsertCount} team agents`);

  // -------------------------------------------------------------------------
  // 4b. Apply exported agent overrides (display_alias, desk, name, role, etc.)
  // -------------------------------------------------------------------------
  for (const p of projectRows) {
    const overrides = loadAgentOverrides(p.name);
    if (Object.keys(overrides).length === 0) continue;

    const projectRow = db.select().from(projects).all().find((pr) => pr.name === p.name);
    if (!projectRow) continue;

    const projectAgents = db.select().from(agents).where(eq(agents.project_id, projectRow.id)).all();

    for (const agent of projectAgents) {
      const cfg = agent.config_json ? JSON.parse(agent.config_json) as Record<string, unknown> : {};
      const originalId = (cfg.original_id as string) ?? agent.name;
      const override = overrides[originalId];
      if (!override) continue;

      const updates: Record<string, unknown> = {};

      if (override.name) updates.name = override.name;
      if (override.role) updates.role = override.role;
      if (override.department !== undefined) updates.department = override.department;
      if (override.emoji !== undefined) updates.emoji = override.emoji;

      // Merge display_alias into config_json
      if (override.display_alias) {
        cfg.display_alias = override.display_alias;
        updates.config_json = JSON.stringify(cfg);
      }

      // Merge desk into persona_json
      if (override.desk) {
        const persona = agent.persona_json ? JSON.parse(agent.persona_json) as Record<string, unknown> : {};
        const office = (persona.office as Record<string, unknown>) ?? {};
        office.desk = override.desk;
        persona.office = office;
        updates.persona_json = JSON.stringify(persona);
      }

      if (Object.keys(updates).length > 0) {
        db.update(agents).set(updates).where(eq(agents.id, agent.id)).run();
        console.log(`  [seed] Applied overrides for agent ${originalId}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Workflows from team-config
  // -------------------------------------------------------------------------
  const workflowList: Array<{
    name: string;
    description: string;
    steps: object[];
    estimatedTime: string;
    parallelizable: boolean;
  }> = teamConfig.workflows;

  for (const wf of workflowList) {
    const row: typeof workflows.$inferInsert = {
      id: nanoid(),
      project_id: autoDetailsId,
      name: wf.name,
      description: wf.description,
      steps_json: JSON.stringify(wf.steps),
      estimated_time: wf.estimatedTime,
      status: 'idle',
      current_step: 0,
    };

    db.insert(workflows).values(row).onConflictDoNothing().run();
  }

  console.log(`Inserted ${workflowList.length} workflows`);

  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
