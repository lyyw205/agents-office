import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { db } from './index.js'; // index.js auto-creates tables on import
import { projects, agents, workflows } from './schema.js';
// ---------------------------------------------------------------------------
// JSON file paths
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../../..');
const masterConfig = JSON.parse(readFileSync(resolve(ROOT, 'master-config/master-config.json'), 'utf-8'));
const teamConfig = JSON.parse(readFileSync(resolve(ROOT, 'projects/auto-details/team-config.json'), 'utf-8'));
const personaConfig = JSON.parse(readFileSync(resolve(ROOT, 'projects/auto-details/agents-persona.json'), 'utf-8'));
// ---------------------------------------------------------------------------
// Scene config for auto-details (building zones)
// ---------------------------------------------------------------------------
const autoDetailsSceneConfig = {
    mapKey: 'auto-details',
    tileSize: 32,
    zones: [
        { id: 'entrance', label: 'Entrance', x: 0, y: 0, w: 4, h: 2, color: '#94A3B8' },
        { id: 'rd', label: 'R&D', x: 0, y: 2, w: 4, h: 3, color: '#3B82F6' },
        { id: 'design', label: 'Design', x: 4, y: 2, w: 4, h: 3, color: '#8B5CF6' },
        { id: 'engineering', label: 'Engineering', x: 0, y: 5, w: 4, h: 3, color: '#10B981' },
        { id: 'qa', label: 'Quality Assurance', x: 4, y: 5, w: 4, h: 3, color: '#F59E0B' },
        { id: 'architecture', label: 'Architecture', x: 0, y: 8, w: 4, h: 3, color: '#EF4444' },
        { id: 'security', label: 'Security', x: 4, y: 8, w: 4, h: 3, color: '#6B7280' },
        { id: 'pm_office', label: 'PM Office', x: 4, y: 0, w: 4, h: 2, color: '#F97316' },
    ],
    deskMap: {
        A1: { zone: 'rd', x: 1, y: 3 },
        B2: { zone: 'design', x: 5, y: 4 },
        C1: { zone: 'engineering', x: 1, y: 6 },
        D3: { zone: 'architecture', x: 2, y: 9 },
        E1: { zone: 'qa', x: 5, y: 6 },
        F2: { zone: 'qa', x: 6, y: 7 },
        G1: { zone: 'engineering', x: 2, y: 6 },
        H3: { zone: 'engineering', x: 3, y: 7 },
        I1: { zone: 'security', x: 5, y: 9 },
    },
};
const teamAgentMap = new Map();
const allTeamAgents = [
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
function resolveAgentType(id) {
    const pmNames = (teamConfig.teamAgents?.pm ?? []).map((a) => a.name);
    const coreNames = (teamConfig.teamAgents?.core ?? []).map((a) => a.name);
    if (pmNames.includes(id))
        return 'pm';
    if (coreNames.includes(id))
        return 'core';
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
    const projectStatusMap = {
        'auto-details': 'active',
        'btc-stacking-bot': 'planned',
        'convengers': 'planned',
    };
    const projectDisplayNames = {
        'auto-details': 'Auto Details',
        'btc-stacking-bot': 'BTC Stacking Bot',
        'convengers': 'Convengers',
    };
    const projectDescriptions = {
        'auto-details': teamConfig.description ?? 'AI 기반 상세페이지 자동 제작 시스템',
        'btc-stacking-bot': 'Bitcoin stacking automation bot',
        'convengers': 'Convengers multi-agent platform',
    };
    const projectRows = masterConfig.projects.map((p) => ({
        id: nanoid(),
        name: p.name,
        display_name: projectDisplayNames[p.name] ?? p.name,
        description: projectDescriptions[p.name] ?? null,
        status: projectStatusMap[p.name] ?? p.status,
        priority: p.priority,
        config_json: null,
        scene_config: p.name === 'auto-details' ? JSON.stringify(autoDetailsSceneConfig) : null,
    }));
    for (const row of projectRows) {
        db.insert(projects).values(row).onConflictDoNothing().run();
    }
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
    const masterRow = {
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
        persona_json: null,
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
    const pmRow = {
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
        persona_json: null,
        skills_json: pmTeamEntry
            ? JSON.stringify(pmTeamEntry.responsibilities.map((r) => ({ name: r })))
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
    const personaAgents = personaConfig.agents;
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
        const row = {
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
    // 5. Workflows from team-config
    // -------------------------------------------------------------------------
    const workflowList = teamConfig.workflows;
    for (const wf of workflowList) {
        const row = {
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
//# sourceMappingURL=seed.js.map