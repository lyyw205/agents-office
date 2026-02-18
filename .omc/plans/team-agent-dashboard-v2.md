# Team Agent Dashboard v2 - Revised Implementation Plan

> **Created**: 2026-02-18
> **Revised**: 2026-02-19 (incorporates Architect + Critic consensus review)
> **Status**: Final Draft (v2.1)
> **Complexity**: HIGH
> **Scope**: Vite + React + Phaser frontend (enhanced) + Hono backend (new) + SQLite database

---

## 1. Context

### Current State
The `agents-office` repository contains a working Phaser.js pixel-art "office simulation" dashboard built with **Vite + React 18 + Zustand + Tailwind CSS + Phaser 3**. It renders the `auto-details` project agents as animated pixel-art characters walking around a tilemap office. The visualization is functional but limited to a single hardcoded project loaded from static JSON files.

### What Exists (PRESERVE -- do not rewrite)

| File | Lines | Purpose |
|------|-------|---------|
| `dashboard/src/components/PhaserGame.tsx` | 73 | Phaser singleton wrapper; prevents React StrictMode double-creation crash on WSL2 |
| `dashboard/src/components/OfficeScene.ts` | 326 | Full tilemap loading (18 tilesets), agent sprite creation/animation, camera drag/zoom, per-frame agent sync from Zustand |
| `dashboard/src/store/agentStore.ts` | 137 | Zustand store: agents, workflows, selectedAgent, simulation state, batch update support |
| `dashboard/src/store/simulationEngine.ts` | 253 | requestAnimationFrame game loop: movement, behavior AI (idle wander, working-at-desk, meeting room), workflow step progression |
| `dashboard/src/data/agentCharacters.ts` | 14 | Agent-to-sprite mapping (10 characters with Generative Agents atlas) |
| `dashboard/src/data/officeMap.ts` | 41 | Tile coordinates: desk positions, meeting room positions, map dimensions (140x100 tiles) |
| `dashboard/src/data/configLoader.ts` | 203 | JSON config loading + hierarchy tree building (Master -> PM -> Agents) |
| `dashboard/src/utils/pathfinding.ts` | 47 | L-shaped pathfinding with Manhattan distance, bounds clamping |
| `dashboard/src/types/index.ts` | 81 | TypeScript interfaces: Agent, Workflow, WorkflowStep, Position, WorldMap, HierarchyNode |
| `dashboard/src/components/Game.tsx` | - | Main game container layout |
| `dashboard/src/components/ControlBar.tsx` | - | Simulation controls (speed, play/pause) |
| `dashboard/src/components/HierarchyPanel.tsx` | - | Agent tree sidebar |
| `dashboard/src/components/AgentDetailsPanel.tsx` | - | Agent detail card |
| `dashboard/src/components/WorkflowPanel.tsx` | - | Workflow step visualization |
| `dashboard/src/hooks/useSimulationTime.ts` | - | Simulation clock hook |

### What Needs Building
- **Hono backend** (new `server/` directory) with REST API, SQLite/Drizzle, Agent Bridge daemon, SSE
- **Multi-project Phaser scenes** -- each project gets its own scene; main dashboard shows overview
- **Dynamic project creation** -- add new projects from the dashboard UI
- **Agent CRUD** -- create agents from scratch (no templates), with "clone agent" as convenience
- **Task management** -- Kanban board, assignment, status tracking
- **Real-time agent execution** -- Agent Bridge connects to Claude Code CLI as a long-lived daemon
- **Korean-first UI** with English toggle

### Target
A centralized, production-grade dashboard to manage N business projects with hierarchical AI agent teams. Pixel-art visualization is a CORE feature (not optional). Single-user, local deployment. Korean primary language.

---

## 2. Architecture

### Why Vite + Hono (NOT Next.js)

The Architect review identified that Next.js is the wrong choice for this project:

1. **Phaser.js is inherently client-only.** It manipulates a `<canvas>` element directly. SSR adds complexity for zero benefit -- Phaser scenes cannot be server-rendered.
2. **The existing dashboard already works with Vite.** 326 lines of OfficeScene.ts, a carefully built PhaserGame singleton wrapper, and a working simulation engine -- all Vite-native.
3. **The Agent Bridge must be a long-lived daemon process**, not a request-scoped serverless function. Next.js API routes are request-scoped; a separate backend process is the correct architecture.

**Decision**: Keep Vite + React frontend. Add Hono as a separate backend process.

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Vite + React + Phaser)                        │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ React UI     │  │ Zustand      │  │ Phaser       │  │
│  │ (panels,     │  │ (agents,     │  │ (tilemap,    │  │
│  │  dialogs,    │<>│  tasks,      │<>│  sprites,    │  │
│  │  kanban)     │  │  workflows)  │  │  animation)  │  │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  │
│         │ REST (POST)                                   │
│         │ SSE  (GET, streaming)                         │
└─────────┼───────────────────────────────────────────────┘
          │
          │ HTTP (localhost:3001)
          │
┌─────────┼───────────────────────────────────────────────┐
│  Hono Backend                                           │
│         │                                               │
│  ┌──────┴───────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ REST API     │  │ SSE Emitter  │  │ Agent Bridge  │  │
│  │ (routes/)    │──│ (push events │  │ (daemon)      │  │
│  │              │  │  to clients) │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│         └─────────┬───────┘                  │          │
│                   │                          │          │
│            ┌──────┴───────┐          ┌───────┴──────┐   │
│            │ SQLite       │          │ Claude Code  │   │
│            │ (Drizzle ORM)│          │ CLI          │   │
│            │ agents-      │          │ (subprocess) │   │
│            │ office.db    │          │              │   │
│            └──────────────┘          └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Communication Pattern: SSE + POST Hybrid

- **Client -> Server**: HTTP POST requests for commands (create agent, assign task, start workflow)
- **Server -> Client**: Server-Sent Events for real-time push (agent status changes, task progress, activity log entries)
- SSE auto-reconnects on disconnect. No WebSocket complexity needed for this one-directional push pattern.

---

## 3. Agent Status State Machine

Explicit state transitions with defined triggers. No implicit jumps.

```
                    ┌─────────────┐
         activate   │             │  deactivate
       ┌───────────>│   inactive  │<───────────┐
       │            │  (default)  │             │
       │            └──────┬──────┘             │
       │                   │ activate           │
       │                   v                    │
       │            ┌──────────────┐            │
       │   ┌───────>│              │────────┐   │
       │   │  done  │     idle     │ assign │   │
       │   │  ┌────>│              │────┐   │   │
       │   │  │     └──────────────┘    │   │   │
       │   │  │                         │   │   │
       │   │  │  timeout/               v   │   │
       │   │  │  cancel          ┌──────────┴─┐ │
       │   │  │  ┌──────────────>│            │ │
       │   │  │  │               │  working   │ │
       │   │  │  │  ┌───────────>│            │ │
       │   │  │  │  │ retry      └─────┬──────┘ │
       │   │  │  │  │                  │        │
       │   │  │  │  │         success  │  fail  │
       │   │  │  │  │                  │        │
       │   │  │  │  │    ┌─────────────┼────┐   │
       │   │  │  │  │    v             v    │   │
       │   │  └──┼──┼─ completed    failed ─┘   │
       │   │     │  │                           │
       │   │     │  └───────────────────────────│
       │   │     │                              │
       │   └─────┘                              │
       │  (completed -> idle after cooldown)    │
       │                                        │
       └────────────────────────────────────────┘
```

### State Definitions

| State | Meaning | Entry Trigger | Exit Trigger |
|-------|---------|---------------|--------------|
| `inactive` | Agent exists but is not deployed | Agent creation (default) OR explicit deactivation | `activate` command |
| `idle` | Agent is active and awaiting work | `activate` command, OR `completed` cooldown (auto, 3s), OR `failed` retry reset | Task assignment |
| `working` | Agent is executing a task via Claude Code CLI | Task assigned to agent | Task success, task failure, timeout, or cancel |
| `completed` | Agent finished current task successfully | Task execution returns success | Auto-transition to `idle` after 3-second cooldown |
| `failed` | Agent's task failed (error, timeout, exit code != 0) | Task execution returns error | Manual retry (-> `working`) or reset (-> `idle`) |

### Removed States
- `reviewing` -- removed. Review is just another task type; the agent is in `working` state while reviewing.
- `blocked` -- removed. Blocking is a task-level concern (task status `blocked`), not an agent-level state. An agent whose task is blocked returns to `idle`.

---

## 4. Data Model

### Core Tables

```sql
projects
  id              TEXT PRIMARY KEY (nanoid)
  name            TEXT NOT NULL UNIQUE (e.g., "auto-details")
  display_name    TEXT NOT NULL (e.g., "AI 상세페이지 제작")
  description     TEXT
  status          TEXT NOT NULL DEFAULT 'active'  -- active | paused | archived
  priority        TEXT NOT NULL DEFAULT 'medium'  -- high | medium | low
  config_json     TEXT  -- flexible project-specific config
  scene_config    TEXT  -- Phaser scene layout config (desk positions, building zones)
  created_at      TEXT DEFAULT (datetime('now'))
  updated_at      TEXT DEFAULT (datetime('now'))

agents
  id              TEXT PRIMARY KEY (nanoid)
  project_id      TEXT REFERENCES projects(id)  -- NULL for master agent
  parent_id       TEXT REFERENCES agents(id)    -- hierarchy: PM parent is master, agent parent is PM
  name            TEXT NOT NULL (e.g., "비전 박사")
  agent_type      TEXT NOT NULL  -- master | pm | core | support
  role            TEXT NOT NULL (e.g., "이미지 분석 전문가")
  department      TEXT
  status          TEXT NOT NULL DEFAULT 'inactive'  -- inactive | idle | working | completed | failed
  model_tier      TEXT DEFAULT 'medium'  -- high=opus | medium=sonnet | low=haiku
  persona_json    TEXT  -- { personality, backstory, motto, avatar, emoji }
  skills_json     TEXT  -- [{ name, level, category }]
  config_json     TEXT  -- agent-specific configuration
  sprite_key      TEXT  -- character sprite atlas key (e.g., "Klaus_Mueller")
  created_at      TEXT DEFAULT (datetime('now'))
  updated_at      TEXT DEFAULT (datetime('now'))

tasks
  id              TEXT PRIMARY KEY (nanoid)
  project_id      TEXT NOT NULL REFERENCES projects(id)
  agent_id        TEXT REFERENCES agents(id)    -- assigned agent, NULL if unassigned
  workflow_id     TEXT REFERENCES workflows(id)
  title           TEXT NOT NULL
  description     TEXT
  status          TEXT NOT NULL DEFAULT 'pending'  -- pending | in_progress | completed | failed | cancelled | blocked
  priority        TEXT DEFAULT 'medium'
  input_json      TEXT  -- task input parameters
  output_json     TEXT  -- task result/output
  error_json      TEXT  -- error details if failed
  started_at      TEXT
  completed_at    TEXT
  created_at      TEXT DEFAULT (datetime('now'))

workflows
  id              TEXT PRIMARY KEY (nanoid)
  project_id      TEXT NOT NULL REFERENCES projects(id)
  name            TEXT NOT NULL
  description     TEXT
  steps_json      TEXT NOT NULL  -- [{ order, name, agent_type, input, output, parallel }]
  estimated_time  TEXT
  status          TEXT DEFAULT 'idle'  -- idle | running | completed | failed
  created_at      TEXT DEFAULT (datetime('now'))

agent_activity_log
  id              TEXT PRIMARY KEY (nanoid)
  agent_id        TEXT NOT NULL REFERENCES agents(id)
  task_id         TEXT REFERENCES tasks(id)
  action          TEXT NOT NULL  -- status_change | task_started | task_completed | task_failed | message | error
  details_json    TEXT  -- { from_status, to_status, message, error_code, ... }
  created_at      TEXT DEFAULT (datetime('now'))

saved_agent_configs
  id              TEXT PRIMARY KEY (nanoid)
  name            TEXT NOT NULL  -- e.g., "나의 디자이너 설정"
  description     TEXT
  agent_type      TEXT NOT NULL
  role            TEXT NOT NULL
  department      TEXT
  model_tier      TEXT DEFAULT 'medium'
  persona_json    TEXT
  skills_json     TEXT
  config_json     TEXT
  source_agent_id TEXT REFERENCES agents(id)  -- which agent this was cloned from (NULL if manual)
  created_at      TEXT DEFAULT (datetime('now'))
```

### Changes from v1
- **Removed**: `skills` table (standalone skill library). Skills live as `skills_json` on agents only.
- **Added**: `saved_agent_configs` table. Even without templates, users can "save as preset" from an existing agent for future reuse. Also supports "clone agent" UX.
- **Added**: `scene_config` on `projects` for per-project Phaser scene layout data.
- **Added**: `sprite_key` on `agents` for character sprite mapping.
- **Added**: `error_json` on `tasks` for structured error capture.
- **Simplified**: Agent status enum (removed `reviewing`, `blocked`; added `failed`).
- **Removed**: All template references. Agent creation is always from scratch or by cloning an existing agent.

### Key Relationships
```
Master Agent (1)
  └── PM Agents (1 per project)
        └── Specialized Agents (N per project)
              └── Tasks (N per agent)
                    └── Activity Log (N per task)

Project (1)
  ├── Agents (N)
  ├── Workflows (N)
  ├── Tasks (N)
  └── Scene Config (1, embedded)

Saved Agent Configs (global, not project-scoped)
  └── source_agent_id -> Agents (optional back-reference)
```

### Migration from Existing JSON
A seed script reads `master-config.json`, `projects/auto-details/team-config.json`, and `projects/auto-details/agents-persona.json` to populate the initial database. Includes `scene_config` generation from existing `officeMap.ts` desk/meeting positions.

---

## 5. Per-Project Phaser Scene Design

### Architecture

Each project gets its own Phaser scene. The main dashboard shows a read-only overview scene; clicking a project opens its dedicated scene.

```
SceneManager
  ├── OverviewScene      -- Main dashboard: minimap thumbnails of all projects
  ├── ProjectScene:auto-details     -- Full interactive scene for auto-details
  ├── ProjectScene:btc-stacking-bot -- Full interactive scene for btc-stacking-bot
  └── ProjectScene:{new-project}    -- Dynamically created on project addition
```

### Scene Generation Strategy

1. **Base tilemap**: Reuse the existing `the_ville_jan7.json` map for all projects (already loaded and proven to work).
2. **Per-project viewport**: Each project scene uses a different camera region of the map, or an entirely separate "building" zone. The map is large (140x100 tiles) with multiple buildings available.
3. **Dynamic desk allocation**: When a new project is created, the system assigns an unused building zone from the map and generates desk positions for the project's agents.
4. **Scene config stored in DB**: The `projects.scene_config` JSON column stores `{ buildingZone: { x, y, w, h }, deskPositions: {...}, meetingPositions: [...] }`.

### Implementation Approach (Refactoring OfficeScene.ts)

```
OfficeScene.ts (326 lines, existing)
  │
  ├── Extract: BaseScene.ts
  │   - Tilemap loading (shared across all project scenes)
  │   - Camera controls (drag, zoom, keyboard)
  │   - Animation creation
  │   - Agent sprite management (syncAgents pattern)
  │
  ├── Extend: ProjectScene.ts extends BaseScene
  │   - Receives projectId in constructor
  │   - Loads project-specific agents from Zustand (filtered by projectId)
  │   - Uses project-specific scene_config for camera centering and desk positions
  │   - Reads/writes to project-scoped Zustand slice
  │
  └── New: OverviewScene.ts extends BaseScene
      - Shows all agents across all projects on one map
      - Read-only (no agent interaction)
      - Clicking an agent's building zone navigates to that ProjectScene
```

### PhaserGame.tsx Changes

The existing singleton pattern remains. The scene manager switches between scenes:

```typescript
// Scene switching (no Phaser.Game destruction needed)
phaserGame.scene.start('ProjectScene', { projectId: 'auto-details' });
phaserGame.scene.stop('OverviewScene');
```

---

## 6. Agent Bridge Daemon Design

### Why a Daemon (Not Request-Scoped)

The Agent Bridge **must** be a long-lived process because:
1. It spawns Claude Code CLI subprocesses that run for seconds to minutes
2. It must track subprocess lifecycle (PID, stdout/stderr streams, exit codes)
3. It pushes SSE events continuously as subprocess output arrives
4. Request-scoped handlers (like Next.js API routes) die after response, orphaning subprocesses

### Architecture

```
Hono Server (persistent Node.js process)
  │
  ├── REST Routes (/api/*)
  │     └── POST /api/tasks/:id/execute
  │           └── bridge.executeTask(taskId)
  │
  ├── SSE Route (/api/sse)
  │     └── Streams events from EventEmitter to connected clients
  │
  └── Agent Bridge (singleton, initialized on server start)
        │
        ├── Process Pool
        │     ├── Subprocess 1 (claude --agent-type executor ...)
        │     ├── Subprocess 2 (claude --agent-type reviewer ...)
        │     └── ... (max concurrent: configurable, default 3)
        │
        ├── EventEmitter
        │     └── Emits: agent_status, task_progress, task_completed, task_failed, error
        │
        └── Lifecycle Manager
              ├── Timeout watchdog (kills subprocess after configurable timeout, default 5min)
              ├── Graceful shutdown (SIGTERM -> wait 10s -> SIGKILL)
              ├── Exit code handling (0=success, non-zero=failure with stderr capture)
              └── Health check (periodic subprocess liveness probe)
```

### Error Handling Strategy (Built-in from Day One)

| Failure Mode | Detection | Response |
|---|---|---|
| Claude Code CLI not found | `spawn` throws ENOENT | Log error, set task `failed`, emit SSE error event, return 503 from API |
| Subprocess timeout | Watchdog timer expires | SIGTERM subprocess, wait 10s, SIGKILL if needed. Set task `failed` with timeout error. Emit SSE. |
| Subprocess crash (exit code != 0) | `close` event with non-zero code | Capture stderr, set task `failed` with error details in `error_json`. Emit SSE. |
| Subprocess OOM | `error` event or SIGKILL from OS | Same as crash. Log memory stats if available. |
| SSE client disconnect | `close` event on response stream | Remove client from active connections. No effect on running subprocesses. |
| Database write failure | Drizzle throws | Retry once. If still fails, log error, keep subprocess running, buffer events in memory. |
| Max concurrent processes reached | Pool full check | Queue the task. Return 202 Accepted with queue position. Process when slot opens. |

### IPC Protocol: stdout-based Streaming

The subprocess communicates back to Hono via **stdout line-buffered JSON**. This is chosen over SQLite polling (adds latency) and named pipes (platform-dependent). Claude Code's `--output-format json` flag produces structured JSON on stdout, which the bridge parses line-by-line and emits as SSE events immediately.

Additionally, the Hono SSE route implements `req.raw.on('close')` to detect client disconnects. On disconnect, running subprocesses are **detached** (not killed) — the task continues and results are written to SQLite. The dashboard can reconnect and see the completed result.

### Subprocess Invocation

```typescript
// Pseudocode for bridge.executeTask()
const proc = spawn('claude', [
  '--print',                    // non-interactive mode
  '--output-format', 'json',   // structured output
  '--max-turns', '25',
  '--model', agent.model_tier === 'high' ? 'opus' : 'sonnet',
  prompt
], {
  cwd: projectDir,
  timeout: TASK_TIMEOUT_MS,
  env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL: '1' }
});

proc.stdout.on('data', (chunk) => {
  // Parse streaming JSON, emit SSE events
  emitter.emit('task_progress', { taskId, agentId, chunk: chunk.toString() });
});

proc.on('close', (code) => {
  if (code === 0) {
    db.update(tasks).set({ status: 'completed', output_json: collectedOutput });
    db.update(agents).set({ status: 'completed' });
    emitter.emit('task_completed', { taskId, agentId });
  } else {
    db.update(tasks).set({ status: 'failed', error_json: collectedStderr });
    db.update(agents).set({ status: 'failed' });
    emitter.emit('task_failed', { taskId, agentId, error: collectedStderr });
  }
});
```

---

## 7. File/Folder Structure

```
agents-office/
├── dashboard/                          # Vite + React + Phaser (EXISTING, enhanced)
│   ├── public/
│   │   └── assets/                     # Tilesets, character sprites (EXISTING)
│   │       ├── map/the_ville_jan7.json
│   │       ├── tilesets/*.png
│   │       └── characters/*.png + atlas.json
│   ├── src/
│   │   ├── main.tsx                    # Entry point (EXISTING)
│   │   ├── App.tsx                     # Root component (ENHANCED: add router)
│   │   │
│   │   ├── components/
│   │   │   ├── phaser/                 # Phaser integration (REFACTORED from existing)
│   │   │   │   ├── PhaserGame.tsx      # Singleton wrapper (EXISTING, minor changes)
│   │   │   │   ├── BaseScene.ts        # Extracted from OfficeScene.ts: tilemap, camera, sprites
│   │   │   │   ├── ProjectScene.ts     # Per-project scene (extends BaseScene)
│   │   │   │   ├── OverviewScene.ts    # Multi-project overview (extends BaseScene)
│   │   │   │   └── SceneManager.ts     # Scene switching logic
│   │   │   │
│   │   │   ├── dashboard/              # Main dashboard page components
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   ├── MasterAgentBanner.tsx
│   │   │   │   ├── ActivityFeed.tsx
│   │   │   │   ├── StatsOverview.tsx
│   │   │   │   └── AddProjectDialog.tsx
│   │   │   │
│   │   │   ├── project/                # Project detail page components
│   │   │   │   ├── AgentTree.tsx
│   │   │   │   ├── TaskBoard.tsx       # Kanban
│   │   │   │   ├── WorkflowPipeline.tsx
│   │   │   │   └── AgentDetailCard.tsx
│   │   │   │
│   │   │   ├── agent/                  # Agent management components
│   │   │   │   ├── AgentProfile.tsx
│   │   │   │   ├── SkillsChart.tsx
│   │   │   │   ├── AgentCreateDialog.tsx   # From scratch, no templates
│   │   │   │   ├── AgentCloneDialog.tsx    # Clone from existing agent
│   │   │   │   └── AgentActivityLog.tsx
│   │   │   │
│   │   │   ├── common/                 # Shared UI components
│   │   │   │   ├── LanguageToggle.tsx
│   │   │   │   ├── StatusBadge.tsx
│   │   │   │   └── EmptyState.tsx
│   │   │   │
│   │   │   ├── Game.tsx                # EXISTING game container
│   │   │   ├── ControlBar.tsx          # EXISTING simulation controls
│   │   │   ├── HierarchyPanel.tsx      # EXISTING agent tree
│   │   │   ├── AgentDetailsPanel.tsx   # EXISTING agent detail
│   │   │   └── WorkflowPanel.tsx       # EXISTING workflow view
│   │   │
│   │   ├── pages/                      # Route-level page components (NEW)
│   │   │   ├── DashboardPage.tsx       # Main overview with OverviewScene
│   │   │   ├── ProjectPage.tsx         # Project detail with ProjectScene
│   │   │   ├── AgentPage.tsx           # Agent full profile
│   │   │   └── WorkflowPage.tsx        # Workflow execution view
│   │   │
│   │   ├── store/                      # Zustand stores (EXISTING, enhanced)
│   │   │   ├── agentStore.ts           # EXISTING (add projectId filtering)
│   │   │   ├── simulationEngine.ts     # EXISTING (multi-project support)
│   │   │   ├── projectStore.ts         # NEW: project CRUD state
│   │   │   ├── taskStore.ts            # NEW: task management state
│   │   │   └── uiStore.ts             # NEW: UI-only state (selected items, panels, locale)
│   │   │
│   │   ├── hooks/                      # React hooks (ENHANCED)
│   │   │   ├── useSimulationTime.ts    # EXISTING
│   │   │   ├── useApi.ts              # NEW: TanStack Query wrappers for backend API
│   │   │   ├── useSSE.ts             # NEW: SSE connection + auto-reconnect
│   │   │   └── useI18n.ts            # NEW: Korean/English locale
│   │   │
│   │   ├── data/                       # Static data (EXISTING)
│   │   │   ├── agentCharacters.ts      # EXISTING sprite mappings
│   │   │   ├── officeMap.ts            # EXISTING tile data
│   │   │   └── configLoader.ts         # EXISTING JSON loader (used for seed migration)
│   │   │
│   │   ├── types/
│   │   │   └── index.ts                # EXISTING (extended with new types)
│   │   │
│   │   ├── i18n/
│   │   │   ├── ko.json                 # Korean translations
│   │   │   ├── en.json                 # English translations
│   │   │   └── index.ts                # i18n setup (lightweight, no next-intl)
│   │   │
│   │   └── lib/
│   │       ├── api.ts                  # API client (fetch wrappers for Hono backend)
│   │       └── utils.ts                # Shared utilities
│   │
│   ├── index.html                      # EXISTING
│   ├── package.json                    # EXISTING (add new deps)
│   ├── tsconfig.json                   # EXISTING
│   ├── vite.config.ts                  # EXISTING (add proxy to backend)
│   ├── tailwind.config.ts              # EXISTING
│   └── postcss.config.js              # EXISTING
│
├── server/                             # NEW: Hono backend
│   ├── src/
│   │   ├── index.ts                    # Server entry: Hono app + bridge init
│   │   │
│   │   ├── routes/
│   │   │   ├── projects.ts             # GET/POST /api/projects, GET/PATCH/DELETE /api/projects/:id
│   │   │   ├── agents.ts              # CRUD for agents (scoped to project)
│   │   │   ├── tasks.ts               # CRUD for tasks + POST /api/tasks/:id/execute
│   │   │   ├── workflows.ts           # CRUD + POST /api/workflows/:id/execute
│   │   │   ├── activity.ts            # GET /api/activity (feed)
│   │   │   ├── saved-configs.ts       # CRUD for saved_agent_configs
│   │   │   └── sse.ts                 # GET /api/sse (event stream)
│   │   │
│   │   ├── db/
│   │   │   ├── schema.ts              # Drizzle schema (all tables)
│   │   │   ├── index.ts               # Database connection (better-sqlite3)
│   │   │   ├── migrate.ts             # Migration runner
│   │   │   └── seed.ts                # Import from existing JSON files
│   │   │
│   │   ├── bridge/
│   │   │   ├── index.ts               # Agent Bridge singleton (daemon lifecycle)
│   │   │   ├── process-pool.ts        # Subprocess pool management
│   │   │   ├── claude-cli.ts          # Claude Code CLI invocation wrapper
│   │   │   └── watchdog.ts            # Timeout + health check
│   │   │
│   │   ├── sse/
│   │   │   └── emitter.ts             # EventEmitter + SSE stream management
│   │   │
│   │   └── lib/
│   │       ├── errors.ts              # Error types + handler middleware
│   │       └── validation.ts          # Zod schemas for all API inputs
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── drizzle.config.ts
│
├── projects/                           # EXISTING project configs
│   └── auto-details/
│       ├── agents-persona.json
│       └── team-config.json
│
├── master-config/                      # EXISTING master config
│   ├── master-config.json
│   └── master-agent.md
│
├── scripts/                            # EXISTING + enhanced
│   ├── install.sh                      # EXISTING
│   ├── setup-project.sh                # EXISTING
│   └── dev.sh                          # NEW: starts both Vite + Hono concurrently
│
├── data/                               # NEW: SQLite database location
│   └── agents-office.db               # Created on first run
│
└── package.json                        # NEW: root workspace package.json
```

---

## 8. Tech Stack

### Frontend (dashboard/)
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Build | **Vite 4** | Already in use; fast HMR; no SSR overhead |
| Framework | **React 18** | Already in use |
| Language | **TypeScript** | Already in use |
| Game Engine | **Phaser 3** | Already in use (326 lines of working scene code) |
| State | **Zustand** | Already in use; add TanStack Query for API cache |
| Styling | **Tailwind CSS 3** | Already in use |
| Routing | **React Router 6** | Client-side SPA routing (lightweight, no Next.js needed) |
| i18n | **Custom lightweight** | Simple JSON files + React context (no next-intl needed without Next.js) |
| Charts | **Recharts** | Dashboard metrics visualization |

### Backend (server/)
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **Hono** | Lightweight, TypeScript-native, fast; designed for edge but works perfectly for local Node.js servers |
| Database | **SQLite via better-sqlite3** | Zero-config, file-based, perfect for single-user local deployment |
| ORM | **Drizzle** | Type-safe SQL, zero runtime overhead, SQLite-native migrations |
| Validation | **Zod** | Runtime type validation on all API inputs |
| Process Mgmt | **Node.js child_process** | For spawning Claude Code CLI subprocesses |

### Root
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Monorepo | **npm workspaces** | Coordinate dashboard/ + server/ without extra tooling |
| Dev runner | **concurrently** | Run Vite + Hono dev servers simultaneously |

---

## 9. Dashboard Features & UI Layout

### 9.1 Main Dashboard (/)

Pixel-art overview scene + project cards side by side.

```
+------------------------------------------------------------------+
|  [Logo] Agents Office          [KR/EN] [Settings]                |
+------------------------------------------------------------------+
|                                                                    |
|  ┌──────────────────────────────────────────┐  Overall Stats      |
|  │                                          │  프로젝트: 3         |
|  │     OVERVIEW SCENE (Phaser)              │  활성 에이전트: 14   |
|  │     All agents visible on minimap        │  실행 중 태스크: 5   |
|  │     Click building zone -> project page  │                     |
|  │                                          │                     |
|  └──────────────────────────────────────────┘                     |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------+  +------------------+  +------------------+  |
|  | auto-details     |  | btc-stacking-bot |  | convengers       |  |
|  | AI 상세페이지     |  | 암호화폐 트레이딩  |  | 멤버 포털         |  |
|  | Status: Active   |  | Status: Active   |  | Status: Planned  |  |
|  | Agents: 10/10    |  | Agents: 4/6      |  | Agents: 0/0      |  |
|  | Tasks: 3 running |  | Tasks: 1 running |  | [+ 설정 시작]     |  |
|  | [프로젝트 보기]   |  | [프로젝트 보기]   |  | [초기화]          |  |
|  +------------------+  +------------------+  +------------------+  |
|                                                                    |
|  [+ 새 프로젝트 추가]                                               |
|                                                                    |
+------------------------------------------------------------------+
|  최근 활동                                                         |
|  - [14:32] vision (auto-details): 이미지 분석 완료                   |
|  - [14:30] executor (auto-details): 위젯 HTML 생성 시작             |
+------------------------------------------------------------------+
```

### 9.2 Project Detail (/projects/:id)

Full-screen Phaser scene for the project + management panels.

```
+------------------------------------------------------------------+
|  < 대시보드    auto-details - AI 상세페이지 제작                      |
+------+-------------------------------------------+---------------+
| TEAM |   PHASER PROJECT SCENE                    | AGENT DETAIL  |
|      |   (agents at desks, moving, animating)    |               |
| PM   |                                           | [Agent Card]  |
| ├ V  |   Click agent -> select in right panel    | Name, Role    |
| ├ D  |   Camera drag/zoom works                  | Status        |
| ├ E  |                                           | Skills Chart  |
| ├ A  |-------------------------------------------| Stats         |
| ├ CR |                                           | Activity Log  |
| ├ QA |  TASK BOARD (Kanban)                      |               |
| ├ PR |  대기중     | 진행중      | 완료           | [수정]        |
| ├ DB |  [Task 1]  | [Task 3]   | [Task 5]      | [에이전트 복제]|
| └ SR |  [Task 2]  | [Task 4]   |               | [비활성화]     |
|      |            |            |               |               |
| [+]  |  [+ 새 태스크]                             |               |
+------+-------------------------------------------+---------------+
```

### 9.3 Agent Creation (No Templates)

**From scratch**: Fill in all fields manually (name, role, department, model tier, skills, persona).

**Clone agent**: Select an existing agent -> "에이전트 복제" button -> pre-fills all fields -> modify as needed -> save as new agent.

**Save as preset**: After creating an agent, option to save the configuration to `saved_agent_configs` for future reuse. This is NOT a template library -- it is a personal presets list.

---

## 10. Implementation Phases

### Phase 1: Foundation + Pixel Art Core -- Week 1-3

**Goal**: Working Vite dashboard with Phaser pixel-art scenes, Hono backend with SQLite, basic CRUD. Pixel art is CORE, not deferred.

**Tasks**:

#### 1.1 Monorepo Setup
- [ ] Create root `package.json` with npm workspaces (`dashboard/`, `server/`)
- [ ] Add `concurrently` for parallel dev server startup
- [ ] Create `scripts/dev.sh` that runs `concurrently "npm run dev -w dashboard" "npm run dev -w server"`
- [ ] **Day 1**: Update `dashboard/vite.config.ts`: change port 3000→5173 (or remove hardcoded port), add `/api` proxy to `localhost:3001`
- [ ] **Day 1**: Move `playwright` from `dashboard/package.json` dependencies to `server/package.json` devDependencies (prevents frontend bundle bloat)
- [ ] Configure Vite proxy: `dashboard/vite.config.ts` proxies `/api/*` to `localhost:3001`

**Acceptance**: `npm run dev` from root starts both servers. Frontend at `:5173`, backend at `:3001`.

#### 1.2 Hono Backend + Database
- [ ] Initialize `server/` with Hono, TypeScript, better-sqlite3, Drizzle
- [ ] Define Drizzle schema for all 6 tables (projects, agents, tasks, workflows, agent_activity_log, saved_agent_configs)
- [ ] Generate and run initial migration
- [ ] Write seed script that imports `master-config.json`, `team-config.json`, `agents-persona.json` into SQLite
- [ ] Include `scene_config` generation in seed (extract from existing `officeMap.ts` desk/meeting positions)
- [ ] Implement Zod validation schemas for all API inputs
- [ ] Build REST routes: projects CRUD, agents CRUD (scoped to project), tasks CRUD
- [ ] Build activity feed route: `GET /api/activity`
- [ ] Add error handling middleware (structured error responses)

**Acceptance**: `curl localhost:3001/api/projects` returns seeded projects. `curl localhost:3001/api/projects/:id/agents` returns agents. All inputs validated. Error responses include structured JSON.

#### 1.3 Phaser Scene Refactoring (Per-Project)
- [ ] **Type migration**: Update `dashboard/src/types/index.ts` `AgentStatus` from `'idle' | 'working' | 'reviewing' | 'blocked' | 'completed'` to `'inactive' | 'idle' | 'working' | 'completed' | 'failed'`
- [ ] **State machine migration**: Remove `reviewing` case from `simulationEngine.ts` (line ~114), add `inactive` and `failed` handling. Update `OfficeScene.ts` status color map (lines ~291-304) to match new states.
- [ ] **Retire hardcoded configLoader**: Replace `configLoader.ts:91` hardcoded `'auto-details-pm'` references with project-parametric loading from backend API
- [ ] **Define 3 predefined building zones** in `officeMap.ts` for dynamic project allocation (extract zone coordinates from the existing 140x100 tile map: Building A, Building B, and one additional zone)
- [ ] Extract `BaseScene.ts` from existing `OfficeScene.ts`: tilemap loading, camera controls, animation creation, agent sprite sync
- [ ] Create `ProjectScene.ts extends BaseScene`: accepts `projectId`, filters agents from project-scoped Zustand slice, uses `scene_config` desk positions
- [ ] **Zustand-to-ProjectScene channel**: ProjectScene subscribes to a project-scoped store selector (`useAgentStore.getState().agents.filter(a => a.projectId === this.projectId)`) instead of reading the full global store. This bounds `syncAgents()` to O(agents-per-project) per frame, not O(all-agents).
- [ ] Create `OverviewScene.ts extends BaseScene`: shows all agents across all projects using RenderTexture compositing (not concurrent scene.start) to avoid multiplicative draw calls
- [ ] Create `SceneManager.ts`: handles scene switching without destroying Phaser.Game instance. Uses the existing `phaserGame` singleton from `PhaserGame.tsx:12` for dynamic `scene.add()`
- [ ] Update `PhaserGame.tsx` to support scene switching (pass scene key via props/callback)
- [ ] Verify existing sprite loading, animation, and camera still works after refactor

**Acceptance**: OverviewScene shows all project agents. Clicking navigates to ProjectScene showing only that project's agents. Camera drag/zoom works. Agent sprites animate. No GPU memory leak on scene switch (verified on WSL2). TypeScript compiles with zero errors on new AgentStatus type.

#### 1.4 Frontend Pages + Routing
- [ ] Add `react-router-dom` to dashboard
- [ ] Create `DashboardPage.tsx`: OverviewScene + project cards + stats + activity feed
- [ ] Create `ProjectPage.tsx`: ProjectScene + agent tree sidebar + basic task list + agent detail panel
- [ ] Create `AgentPage.tsx`: full agent profile (skills chart, stats, task history)
- [ ] Wire pages to backend API via TanStack Query hooks
- [ ] Implement Korean/English i18n (lightweight JSON + React context)
- [ ] Add language toggle to header
- [ ] Dynamic project addition: "새 프로젝트 추가" button opens dialog, POST to backend, new project appears in list

**Acceptance**: Navigate between Dashboard -> Project -> Agent pages. Data loads from SQLite via API. Korean text displays. New project can be created from UI. Language toggle works.

#### 1.5 Agent CRUD (From Scratch + Clone)
- [ ] Agent creation dialog: manual from-scratch form (name, role, department, model tier, skills, persona)
- [ ] Agent clone dialog: select existing agent, pre-fill form, modify, save as new
- [ ] "Save as preset" option after creation (writes to `saved_agent_configs`)
- [ ] Agent edit + deactivate
- [ ] New agents appear in Phaser scene with auto-assigned desk position

**Acceptance**: Create agent from scratch with Korean name/role. Clone existing agent. Saved preset appears in configs list. New agent visible in Phaser scene at assigned desk.

---

### Phase 2: Task Management + Workflows -- Week 4-5

**Goal**: Kanban task board, workflow execution, activity tracking. E2E tests.

**Tasks**:

#### 2.1 Task Board
- [ ] Kanban-style task board on project page (대기중 | 진행중 | 완료 | 실패)
- [ ] Task creation dialog with agent assignment dropdown
- [ ] Drag-and-drop between columns (or button-based status change)
- [ ] Task detail view: input, output, error, timestamps, assigned agent

**Acceptance**: Tasks move through statuses. Assigned agent shown on task card. Failed tasks show error details.

#### 2.2 Workflow Engine
- [ ] Workflow execution view with visual step pipeline (horizontal)
- [ ] Each step shows: assigned agent type, status, progress bar
- [ ] Parallel steps rendered side-by-side
- [ ] Start/cancel workflow buttons
- [ ] Workflow step progression updates agent status in Zustand -> reflected in Phaser scene

**Acceptance**: Starting a workflow advances through steps. Agent sprites in Phaser move to desks/meeting rooms during workflow. Workflow completes and all agents return to idle.

#### 2.3 Activity Feed + Logging
- [ ] Real activity feed on main dashboard (from `agent_activity_log` table)
- [ ] Activity log on agent detail page (filtered to that agent)
- [ ] Log entries created on: agent status change, task start/complete/fail

**Acceptance**: Activity feed shows timestamped entries. Agent page shows agent-specific history.

#### 2.4 E2E Testing
- [ ] Set up Playwright (already in dashboard dependencies)
- [ ] E2E tests: dashboard loads, project navigation works, agent creation works, task CRUD works
- [ ] API tests for all Hono routes (use Hono test client or supertest-equivalent)

**Acceptance**: `npm run test:e2e` passes. `npm run test:api` passes. CI-ready test scripts.

---

### Phase 3: Agent Bridge + Real-Time -- Week 6-7

**Goal**: Connect dashboard to actual Claude Code execution. Real-time SSE updates.

**Tasks**:

#### 3.1 Agent Bridge Daemon
- [ ] Implement `bridge/index.ts`: singleton bridge initialized on Hono server start
- [ ] Implement `bridge/process-pool.ts`: subprocess pool (max concurrent: 3, configurable)
- [ ] Implement `bridge/claude-cli.ts`: Claude Code CLI wrapper (`spawn` with `--print --output-format json`)
- [ ] Implement `bridge/watchdog.ts`: timeout watchdog (default 5min per task), health check
- [ ] Error handling: ENOENT (CLI not found), non-zero exit code, timeout, OOM -- all write to `error_json` and emit events
- [ ] `POST /api/tasks/:id/execute` triggers bridge execution

**Acceptance**: Assigning a task triggers Claude Code execution. Bridge handles timeout, crash, success. Process pool respects max concurrent limit. Error details captured in database.

#### 3.2 SSE Real-Time Push
- [ ] Implement `sse/emitter.ts`: EventEmitter wrapping SSE stream
- [ ] Implement `routes/sse.ts`: `GET /api/sse` endpoint with proper SSE headers
- [ ] Implement `hooks/useSSE.ts` in frontend: connect, auto-reconnect on disconnect, parse events
- [ ] Bridge emits events: `agent_status`, `task_progress`, `task_completed`, `task_failed`
- [ ] Frontend receives SSE events -> updates Zustand stores -> Phaser scene + React UI update automatically
- [ ] Real-time status indicators on agent cards, task board, workflow pipeline

**Acceptance**: Agent status updates appear in real-time without page refresh. SSE reconnects within 3 seconds of disconnect. Phaser sprites reflect real-time agent status (working animation, status ring color).

#### 3.3 Error Handling Hardening
- [ ] API input validation with Zod on ALL routes (not just some)
- [ ] Structured error responses: `{ error: string, code: string, details?: object }`
- [ ] Bridge error recovery: failed subprocess cleanup (no orphan processes)
- [ ] Frontend error display: toast notifications for task failures, connection loss indicator for SSE
- [ ] Health check endpoint: `GET /api/health` returns bridge status, DB status, active subprocess count

**Acceptance**: No unhandled errors in console. All API errors return structured JSON. Bridge cleans up orphan processes on shutdown. Health endpoint reports accurate status.

---

### Phase 4: Polish + Production Hardening -- Week 8-9

**Goal**: Production-ready quality for daily use. Performance, metrics, UX refinement.

**Tasks**:

#### 4.1 Dashboard Metrics
- [ ] Project stats charts (Recharts): tasks per project, agent utilization, workflow completion rates
- [ ] Agent performance charts: tasks completed, success rate, avg execution time
- [ ] Real-time updating via SSE

#### 4.2 Performance
- [ ] Pagination on task lists (50+ tasks)
- [ ] Virtual scrolling on activity feed (200+ entries)
- [ ] Phaser scene optimization: verify no memory leak on scene switch (especially important on WSL2)
- [ ] SQLite WAL mode for better read concurrency
- [ ] Database indexes on commonly queried columns

#### 4.3 UX Refinement
- [ ] Responsive layout for tablet (desktop-first, but panels stack on narrow viewport)
- [ ] Keyboard shortcuts for common actions (N=new task, E=edit, Esc=close dialog)
- [ ] Desktop notifications (browser Notification API) for task completion/failure
- [ ] Loading states and skeleton screens for all async data

#### 4.4 Data Management
- [ ] Data export: CSV export for tasks, agents, activity log
- [ ] Database backup script (copy SQLite file)
- [ ] Seed script upgrade: re-import from JSON without destroying existing data

**Acceptance**: Dashboard loads in under 2 seconds with 50+ agents and 200+ tasks. No memory leaks on prolonged use. Metrics charts update in real-time. CSV export works.

---

## 11. Testing Strategy

| Phase | Test Type | Tool | Scope |
|-------|-----------|------|-------|
| Phase 1 | Unit tests | Vitest | Zustand stores, utility functions, config loaders |
| Phase 1 | API tests | Hono test client | All REST endpoints (happy path + error cases) |
| Phase 2 | E2E tests | Playwright | Dashboard navigation, CRUD flows, Phaser scene loading |
| Phase 2 | API tests | Hono test client | Task lifecycle, workflow execution, activity logging |
| Phase 3 | Integration tests | Vitest + mocks | Agent Bridge with mocked Claude CLI subprocess |
| Phase 3 | SSE tests | Custom | SSE connection, reconnect, event parsing |
| Phase 4 | Performance tests | Lighthouse + custom | Load time, memory usage, large dataset handling |

### Testing Principles
- API tests run against an in-memory SQLite database (no file I/O in tests)
- Phaser scene tests focus on scene lifecycle (create/destroy), not visual rendering
- Agent Bridge tests mock `child_process.spawn` to simulate CLI behavior without actual Claude Code
- E2E tests cover the critical user paths: create project -> add agents -> assign task -> view result

---

## 12. Success Criteria (Overall)

1. **Multi-project dashboard** with N dynamically addable projects, each with its own Phaser scene
2. **Pixel-art visualization** as CORE feature: agents walk, animate, reflect real-time status
3. **Agent CRUD** from scratch (no templates) with "clone agent" convenience
4. **Agent status state machine**: `inactive -> idle -> working -> completed -> idle` (with `failed` path)
5. **Task lifecycle**: create -> assign -> execute (via Claude Code) -> completed/failed
6. **Workflow execution** visualized as step pipeline with live Phaser agent movement
7. **Real-time SSE updates** for all status changes without page refresh
8. **Agent Bridge daemon** with subprocess pool, timeout watchdog, error handling
9. **Korean-first UI** with English toggle
10. **Data persists** in SQLite across restarts
11. **Runs locally** with `npm run dev` -- no cloud dependencies
12. **Test coverage**: API tests, E2E tests, Bridge integration tests

---

## 13. Risk Factors

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Phaser scene refactoring breaks existing functionality | Medium | High | Phase 1.3 has explicit "verify existing behavior" acceptance criteria. Keep OfficeScene.ts as reference until BaseScene is proven. |
| Per-project scene switching causes GPU memory leak on WSL2 | Medium | High | Test on WSL2 early. Reuse single Phaser.Game instance (scene.start/stop, not game.destroy/create). |
| Claude Code CLI integration complexity | Medium | Medium | Phase 3 is isolated. Phases 1-2 work with manual status updates. Mock bridge for early testing. |
| SQLite concurrent writes from SSE + API | Low | Low | Single-user dashboard; WAL mode handles concurrent reads. Writes are serialized by nature of SQLite. |
| Hono + Vite dev server coordination | Low | Low | Vite proxy eliminates CORS. `concurrently` handles process lifecycle. |
| Scene config generation for new projects (desk allocation) | Medium | Medium | Start with predefined building zones on the existing map. Algorithmic allocation is Phase 1 stretch goal. |

---

## 14. Resolved Contradictions (from v1)

| v1 Issue | v2 Resolution |
|----------|---------------|
| Pixel-art listed as Phase 4 optional AND described as core feature | Pixel-art is Phase 1 CORE. OverviewScene + ProjectScene built in Phase 1.3. |
| Next.js recommended but Phaser is client-only | Vite kept as frontend. Hono added as separate backend. No SSR. |
| Agent Bridge in request-scoped API routes | Bridge runs as daemon within Hono process (long-lived). |
| Templates referenced in agent creation | All template references removed. Agent creation is from scratch or clone. |
| Skills table + skills on agents (redundant) | Skills table removed. Skills live as `skills_json` on agents only. `saved_agent_configs` replaces template concept. |
| Error handling deferred to Phase 4 | Error handling built into Phase 1 (API validation) and Phase 3 (Bridge errors). |
| Fixed 3-project list vs dynamic project addition | Dynamic project addition from Phase 1. |
| `reviewing` and `blocked` agent states ambiguous | Removed. `reviewing` is just `working` on a review task. `blocked` is a task-level concern. |
| Phase 1 timeline of 2 weeks for Phaser integration | Extended to 3 weeks (Phase 1 is Week 1-3). |

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **Agent Bridge** | Long-lived Node.js daemon inside the Hono server that spawns and manages Claude Code CLI subprocesses |
| **Scene Config** | JSON stored in `projects.scene_config` defining Phaser camera position, desk coordinates, and building zones for a project |
| **BaseScene** | Abstract Phaser.Scene extracted from OfficeScene.ts containing shared tilemap, camera, and sprite logic |
| **ProjectScene** | Phaser.Scene subclass of BaseScene that renders a single project's agents |
| **OverviewScene** | Phaser.Scene subclass of BaseScene that renders all projects' agents as a minimap |
| **Saved Agent Config** | A saved agent configuration (not a template) that pre-fills the agent creation form |
| **Clone Agent** | Create a new agent by copying all fields from an existing agent |
