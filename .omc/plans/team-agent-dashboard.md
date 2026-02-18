# Team Agent Dashboard - Implementation Plan

> **Created**: 2026-02-18
> **Status**: Draft
> **Complexity**: HIGH
> **Scope**: Full-stack application rebuild (frontend + backend + database)

---

## 1. Context

### Current State
The `agents-office` repository contains a Phaser.js pixel-art "office simulation" dashboard built with React + Vite + Zustand + Tailwind. It is a single-project visualization that loads static JSON files from `public/data/`. Only the `auto-details` project has agent data wired up; `btc-stacking-bot` and `convengers` exist only as stubs in `master-config.json`.

### What Exists (Reusable)
- **Data schemas**: Agent hierarchy (Master -> PM -> Agent), persona data (backstories, skills, stats, personalities), workflow definitions with steps -- all in JSON format under `projects/auto-details/` and `master-config/`
- **Agent persona model**: Rich character definitions in `agents-persona.json` (9 agents with Korean names, backstories, skills with levels, department assignments)
- **Workflow definitions**: 3 workflows with step-by-step agent assignments in `team-config.json`
- **Hierarchy concept**: 3-tier model (Master Orchestrator -> Project PM -> Specialized Agents) already defined in `master-config.json` and `master-agent.md`
- **Visualization research**: Research doc (`claudedocs/research_agent_visualization_2026-02-18.md`) evaluating AI Town, PixiJS, Phaser.js options

### What Needs Rebuilding
- The existing dashboard is a toy simulation, not a production management tool
- No backend, no database, no authentication, no real-time agent communication
- No multi-project support in the UI (only renders one project)
- No agent creation/deletion, no task assignment, no status tracking
- No connection to actual Claude Code agent execution

### Target
A centralized, production-grade dashboard to manage 3-4 business projects with hierarchical AI agent teams. Korean language as the primary UI language with English fallback. Agents are created on-demand, report status in real-time, and are orchestrated through the dashboard.

---

## 2. Work Objectives

1. Build a multi-project management dashboard where all business projects are visible from one screen
2. Implement agent hierarchy management (Master -> Project Lead/PM -> Specialized Agents)
3. Enable on-demand agent creation with role assignment per project
4. Track tasks, agent status, and workflow execution in real-time
5. Connect the dashboard to Claude Code as the AI execution backbone
6. Support Korean as the primary language

---

## 3. Guardrails

### Must Have
- Multi-project view with drill-down to individual projects
- Agent CRUD: create, view, update status, deactivate agents per project
- Task tracking: assign tasks to agents, track progress, view results
- Agent hierarchy visualization (3-tier tree)
- Real-time status updates (agent idle/working/blocked/completed)
- Persistent data storage (not static JSON files)
- Korean language UI
- Responsive layout (desktop-first, but usable on tablet)

### Must NOT Have
- Mobile-native app (web-only for MVP)
- Multi-user authentication/authorization (single-user for now)
- Billing/payment integration
- Public-facing API for third parties
- The pixel-art office simulation (defer to Phase 3 as optional enhancement)

---

## 4. Tech Stack Recommendation

### Frontend
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **Next.js 15 (App Router)** | SSR for fast initial load, API routes for backend, file-based routing, React Server Components for data-heavy dashboard views |
| Language | **TypeScript** | Already used in existing dashboard, type safety for complex agent data models |
| Styling | **Tailwind CSS 4 + shadcn/ui** | Already familiar from existing codebase, shadcn/ui provides polished Korean-friendly components |
| State | **Zustand** (client) + **TanStack Query** (server) | Zustand already in use; TanStack Query for API cache/sync |
| Charts | **Recharts** or **Tremor** | Dashboard metrics visualization |
| i18n | **next-intl** | Korean/English with message-file approach |
| Real-time | **Server-Sent Events (SSE)** | Simpler than WebSocket for one-directional status updates from agents |

### Backend
| Layer | Choice | Rationale |
|-------|--------|-----------|
| API | **Next.js API Routes (Route Handlers)** | Co-located with frontend, no separate server needed for MVP |
| Database | **SQLite via Drizzle ORM** | Zero-config, file-based, perfect for single-user local dashboard. Migrate to PostgreSQL later if needed |
| Real-time | **SSE endpoints** | Push agent status updates to dashboard |
| Agent Bridge | **Claude Code CLI wrapper** | Shell exec to invoke Claude Code commands, parse output, update agent status |

### Why This Stack
- **Next.js + SQLite**: The user runs this locally for personal business management. No need for cloud database overhead. SQLite is embedded, fast, and sufficient for 3-4 projects with dozens of agents.
- **Drizzle ORM**: Type-safe SQL with zero runtime overhead, migrations built in, works perfectly with SQLite.
- **No Convex/Supabase**: The AI Town architecture doc references Convex, but that adds unnecessary cloud dependency for a local management tool. Keep it simple.
- **SSE over WebSocket**: Agent status flows one direction (agent -> dashboard). SSE is simpler, auto-reconnects, works through proxies.

---

## 5. Data Model

### Core Tables

```
projects
  id            TEXT PRIMARY KEY (uuid)
  name          TEXT NOT NULL (e.g., "auto-details")
  display_name  TEXT NOT NULL (e.g., "AI 상세페이지 제작")
  description   TEXT
  status        TEXT NOT NULL DEFAULT 'active' (active | paused | archived)
  priority      TEXT NOT NULL DEFAULT 'medium' (high | medium | low)
  config_json   TEXT  -- flexible project-specific config
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP

agents
  id            TEXT PRIMARY KEY (uuid)
  project_id    TEXT REFERENCES projects(id) -- NULL for master agent
  parent_id     TEXT REFERENCES agents(id)  -- hierarchy: PM's parent is master, agent's parent is PM
  name          TEXT NOT NULL (e.g., "비전 박사")
  agent_type    TEXT NOT NULL (master | pm | core | support)
  role          TEXT NOT NULL (e.g., "이미지 분석 전문가")
  department    TEXT
  status        TEXT NOT NULL DEFAULT 'inactive' (active | idle | working | reviewing | blocked | inactive)
  model_tier    TEXT DEFAULT 'medium' (high=opus | medium=sonnet | low=haiku)
  persona_json  TEXT  -- personality, backstory, motto, avatar, emoji
  skills_json   TEXT  -- array of {name, level, category}
  config_json   TEXT  -- agent-specific configuration
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP

tasks
  id            TEXT PRIMARY KEY (uuid)
  project_id    TEXT NOT NULL REFERENCES projects(id)
  agent_id      TEXT REFERENCES agents(id)  -- assigned agent, NULL if unassigned
  workflow_id   TEXT REFERENCES workflows(id)
  title         TEXT NOT NULL
  description   TEXT
  status        TEXT NOT NULL DEFAULT 'pending' (pending | in_progress | completed | failed | cancelled)
  priority      TEXT DEFAULT 'medium'
  input_json    TEXT  -- task input parameters
  output_json   TEXT  -- task result/output
  started_at    DATETIME
  completed_at  DATETIME
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP

workflows
  id            TEXT PRIMARY KEY (uuid)
  project_id    TEXT NOT NULL REFERENCES projects(id)
  name          TEXT NOT NULL
  description   TEXT
  steps_json    TEXT NOT NULL  -- ordered array of {order, name, agent_type, skill, input, output, parallel}
  estimated_time TEXT
  status        TEXT DEFAULT 'idle' (idle | running | completed | failed)
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP

agent_activity_log
  id            TEXT PRIMARY KEY (uuid)
  agent_id      TEXT NOT NULL REFERENCES agents(id)
  task_id       TEXT REFERENCES tasks(id)
  action        TEXT NOT NULL (started | completed | failed | status_change | message)
  details_json  TEXT
  timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP

skills
  id            TEXT PRIMARY KEY (uuid)
  name          TEXT NOT NULL UNIQUE
  description   TEXT
  source        TEXT  -- e.g., "oh-my-claudecode", "community"
  category      TEXT
  config_json   TEXT
```

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
  └── Tasks (N)
```

### Migration from Existing JSON
The existing JSON files (`master-config.json`, `team-config.json`, `agents-persona.json`) will be imported as seed data during initial setup. A one-time migration script reads these files and populates the SQLite database.

---

## 6. Dashboard Features & UI Layout

### 6.1 Main Dashboard (/)
The landing page showing all projects at a glance.

```
+------------------------------------------------------------------+
|  [Logo] Agents Office          [KR/EN] [Settings]                |
+------------------------------------------------------------------+
|                                                                    |
|  MASTER ORCHESTRATOR                        Overall Stats          |
|  Status: Active                             Projects: 3            |
|  [마스터 오케스트레이터]                       Active Agents: 14     |
|                                             Running Tasks: 5       |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------+  +------------------+  +------------------+  |
|  | auto-details     |  | btc-stacking-bot |  | convengers       |  |
|  | AI 상세페이지     |  | 암호화폐 트레이딩  |  | 멤버 포털         |  |
|  |                  |  |                  |  |                  |  |
|  | Status: Active   |  | Status: Active   |  | Status: Planned  |  |
|  | Agents: 10/10    |  | Agents: 4/6      |  | Agents: 0/0      |  |
|  | Tasks: 3 running |  | Tasks: 1 running |  | [+ Setup]        |  |
|  |                  |  |                  |  |                  |  |
|  | [View Project]   |  | [View Project]   |  | [Initialize]     |  |
|  +------------------+  +------------------+  +------------------+  |
|                                                                    |
|  [+ Add New Project]                                               |
|                                                                    |
+------------------------------------------------------------------+
|  Recent Activity Feed                                              |
|  - [14:32] vision (auto-details): 이미지 분석 완료                   |
|  - [14:30] executor (auto-details): 위젯 HTML 생성 시작             |
|  - [14:28] scientist (btc-stacking-bot): 데이터 분석 완료           |
+------------------------------------------------------------------+
```

### 6.2 Project Detail (/projects/[id])
Deep dive into a single project.

**Left sidebar**: Agent hierarchy tree (collapsible)
**Center**: Task board (Kanban-style: Pending | In Progress | Completed)
**Right sidebar**: Selected agent detail or workflow view

```
+------------------------------------------------------------------+
|  < Back to Dashboard    auto-details - AI 상세페이지 제작           |
+------+-------------------------------------------+---------------+
| TEAM |         TASK BOARD                        | AGENT DETAIL  |
|      |                                           |               |
| PM   |  Pending    | In Progress | Completed     | [Agent Card]  |
| ├ V  |  [Task 1]   | [Task 3]    | [Task 5]     | Name, Role    |
| ├ D  |  [Task 2]   | [Task 4]    |              | Status        |
| ├ E  |             |             |              | Skills Chart  |
| ├ A  |             |             |              | Stats         |
| ├ CR |  [+ New Task]                             | Activity Log  |
| ├ QA |                                           |               |
| ├ PR |                                           | [Edit Agent]  |
| ├ DB |                                           | [Deactivate]  |
| └ SR |                                           |               |
|      |                                           |               |
| [+]  |  WORKFLOWS                                |               |
|      |  [reference-to-widgets] Running Step 3/6  |               |
|      |  [product-to-html] Idle                   |               |
|      |  [quality-review] Idle                    |               |
+------+-------------------------------------------+---------------+
```

### 6.3 Agent Detail (/projects/[id]/agents/[agentId])
Full-page agent profile.

- Profile card: name, role, emoji/avatar, backstory, personality traits
- Skills radar chart (skill levels by category)
- Performance stats: tasks completed, success rate, avg response time
- Task history: list of past and current tasks with status
- Activity timeline: chronological log of agent actions
- Configuration: model tier, department, specialties
- Actions: Edit, Deactivate, Reassign to another project

### 6.4 Agent Creation Dialog
Modal/drawer for creating new agents.

- Select project
- Choose agent type template (or custom)
- Set name (Korean + English), role, department
- Configure model tier (opus/sonnet/haiku)
- Assign skills from skill library
- Optional: set persona (personality traits, backstory, motto)
- Preview before creation

### 6.5 Workflow Execution View (/projects/[id]/workflows/[workflowId])
Visual pipeline view.

- Step-by-step flow diagram (horizontal pipeline)
- Each step shows: assigned agent, status, progress %, input/output
- Parallel steps rendered side-by-side
- Live progress updates via SSE
- Action buttons: Start, Pause, Cancel workflow

---

## 7. Agent Communication & Status Reporting

### Architecture
```
Claude Code CLI
      |
      v
Agent Bridge (Node.js wrapper)
      |
      v
SSE Event Stream --> Dashboard (browser)
      |
      v
SQLite (persist status + logs)
```

### Agent Bridge Design
The Agent Bridge is a thin Node.js service layer that:
1. **Receives commands** from the dashboard API (e.g., "assign task X to agent Y")
2. **Invokes Claude Code** via CLI subprocess (`claude --agent-type executor --prompt "..."`)
3. **Parses output** and updates the database with status changes
4. **Emits SSE events** to connected dashboard clients

### Status Flow
```
Dashboard UI  --(HTTP POST)--> API Route --(spawn)--> Claude Code CLI
                                  |
                                  +--(SSE)--> Dashboard UI (real-time update)
                                  |
                                  +--(INSERT)--> SQLite (activity_log)
```

### Agent States
| State | Meaning | Trigger |
|-------|---------|---------|
| `inactive` | Agent exists but not deployed | Creation default |
| `idle` | Agent is active, waiting for tasks | After task completion or activation |
| `working` | Agent is executing a task | Task assignment |
| `reviewing` | Agent is in review/QA mode | Review task assignment |
| `blocked` | Agent cannot proceed | Dependency unmet or error |
| `completed` | Agent finished current task | Task completion |

---

## 8. File/Folder Structure

```
agents-office/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout with i18n provider
│   ├── page.tsx                  # Main dashboard (/)
│   ├── projects/
│   │   ├── page.tsx              # Projects list (redirect to /)
│   │   └── [id]/
│   │       ├── page.tsx          # Project detail view
│   │       ├── agents/
│   │       │   └── [agentId]/
│   │       │       └── page.tsx  # Agent detail view
│   │       └── workflows/
│   │           └── [workflowId]/
│   │               └── page.tsx  # Workflow execution view
│   ├── settings/
│   │   └── page.tsx              # Global settings
│   └── api/
│       ├── projects/
│       │   ├── route.ts          # GET (list), POST (create)
│       │   └── [id]/
│       │       ├── route.ts      # GET, PATCH, DELETE
│       │       └── agents/
│       │           └── route.ts  # GET (list), POST (create)
│       ├── agents/
│       │   └── [id]/
│       │       ├── route.ts      # GET, PATCH, DELETE
│       │       └── tasks/
│       │           └── route.ts  # GET (list), POST (assign)
│       ├── tasks/
│       │   └── [id]/
│       │       └── route.ts      # GET, PATCH (update status)
│       ├── workflows/
│       │   └── [id]/
│       │       ├── route.ts      # GET, POST (start)
│       │       └── execute/
│       │           └── route.ts  # POST (trigger execution)
│       ├── activity/
│       │   └── route.ts          # GET (activity feed)
│       └── sse/
│           └── route.ts          # SSE endpoint for real-time updates
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── dashboard/
│   │   ├── ProjectCard.tsx
│   │   ├── MasterAgentBanner.tsx
│   │   ├── ActivityFeed.tsx
│   │   └── StatsOverview.tsx
│   ├── project/
│   │   ├── AgentTree.tsx
│   │   ├── TaskBoard.tsx
│   │   ├── WorkflowPipeline.tsx
│   │   └── AgentDetailCard.tsx
│   ├── agent/
│   │   ├── AgentProfile.tsx
│   │   ├── SkillsChart.tsx
│   │   ├── AgentCreateDialog.tsx
│   │   └── AgentActivityLog.tsx
│   └── common/
│       ├── LanguageToggle.tsx
│       ├── StatusBadge.tsx
│       └── EmptyState.tsx
│
├── lib/
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema definitions
│   │   ├── index.ts              # DB connection (SQLite)
│   │   ├── migrate.ts            # Migration runner
│   │   └── seed.ts               # Seed from existing JSON files
│   ├── agent-bridge/
│   │   ├── index.ts              # Bridge entry point
│   │   ├── claude-cli.ts         # Claude Code CLI wrapper
│   │   ├── task-runner.ts        # Task execution orchestrator
│   │   └── sse-emitter.ts        # SSE event management
│   ├── i18n/
│   │   ├── messages/
│   │   │   ├── ko.json           # Korean translations
│   │   │   └── en.json           # English translations
│   │   └── config.ts             # next-intl configuration
│   └── utils.ts                  # Shared utilities
│
├── hooks/
│   ├── useProjects.ts            # TanStack Query hooks for projects
│   ├── useAgents.ts              # TanStack Query hooks for agents
│   ├── useTasks.ts               # TanStack Query hooks for tasks
│   └── useSSE.ts                 # SSE connection hook
│
├── stores/
│   └── ui-store.ts               # Zustand for UI-only state (selected items, panels)
│
├── data/
│   └── seed/                     # Existing JSON files copied here for seeding
│       ├── master-config.json
│       ├── agents-persona.json
│       └── team-config.json
│
├── public/
│   └── assets/                   # Static assets (avatars, icons)
│
├── drizzle/                      # Generated migration files
├── drizzle.config.ts             # Drizzle configuration
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json
├── package.json
│
├── projects/                     # KEEP: existing project config reference
├── master-config/                # KEEP: existing master config reference
├── scripts/                      # KEEP: existing utility scripts
└── .omc/                         # OMC orchestration state
```

---

## 9. Implementation Phases

### Phase 1: Foundation (MVP) -- Week 1-2
**Goal**: Working dashboard that displays projects and agents from a real database.

**Tasks**:
1. Initialize Next.js 15 project with TypeScript, Tailwind, shadcn/ui
2. Set up Drizzle ORM with SQLite, define schema for all 6 tables
3. Write seed script that imports existing JSON data (master-config, team-config, agents-persona) into SQLite
4. Build main dashboard page: project cards, master agent banner, stats overview
5. Build project detail page: agent hierarchy tree, basic task list
6. Build agent detail page: profile card, skills, stats
7. Implement Korean/English i18n with next-intl
8. Wire up API routes for CRUD operations on projects, agents, tasks

**Acceptance Criteria**:
- [ ] `npm run dev` starts the dashboard at localhost:3000
- [ ] Main dashboard shows 3 project cards (auto-details active, btc-stacking-bot planned, convengers planned)
- [ ] Clicking a project card navigates to project detail with agent tree
- [ ] Clicking an agent shows full profile with Korean text
- [ ] All data persists in SQLite (survives server restart)
- [ ] Language toggle switches between Korean and English
- [ ] Agent CRUD works via API: create new agent, update status, deactivate

### Phase 2: Task Management & Workflows -- Week 3-4
**Goal**: Assign tasks, run workflows, track progress.

**Tasks**:
1. Build Kanban-style task board on project detail page (Pending | In Progress | Completed)
2. Implement task creation dialog with agent assignment
3. Build workflow execution view with visual pipeline
4. Implement workflow engine: step-by-step execution with status tracking
5. Add activity feed on main dashboard (recent actions across all projects)
6. Add agent creation dialog with role templates

**Acceptance Criteria**:
- [ ] Tasks can be created, assigned to agents, and moved through statuses
- [ ] Workflows display as visual step pipelines with agent assignments
- [ ] Starting a workflow updates step statuses and assigned agent statuses
- [ ] Activity feed shows timestamped actions across all projects
- [ ] New agents can be created with template roles (designer, debugger, etc.)

### Phase 3: Agent Bridge & Real-Time -- Week 5-6
**Goal**: Connect dashboard to actual Claude Code execution.

**Tasks**:
1. Build Agent Bridge: Node.js wrapper around Claude Code CLI
2. Implement SSE endpoint for real-time status pushes
3. Build useSSE hook for dashboard to consume status updates
4. Wire task execution: dashboard triggers Agent Bridge, Bridge invokes Claude Code, status flows back via SSE
5. Implement agent activity logging to `agent_activity_log` table
6. Add real-time status indicators on all agent representations (tree, cards, board)

**Acceptance Criteria**:
- [ ] Assigning a task triggers Claude Code execution via Agent Bridge
- [ ] Agent status updates appear in real-time on the dashboard without page refresh
- [ ] Activity log records all agent actions with timestamps
- [ ] Dashboard reconnects SSE stream automatically on disconnect

### Phase 4: Polish & Production Hardening -- Week 7-8
**Goal**: Production-ready quality for daily use.

**Tasks**:
1. Add dashboard metrics charts (Recharts/Tremor): tasks per project, agent utilization, workflow completion rates
2. Error handling: graceful failures when Claude Code is unavailable, task retry logic
3. Data validation: Zod schemas on all API inputs
4. Performance: pagination on task lists, virtual scrolling for activity feed
5. Responsive layout refinement for tablet
6. Optional: Re-integrate pixel-art agent visualization as a "fun view" toggle using existing Phaser.js code

**Acceptance Criteria**:
- [ ] Dashboard loads in under 2 seconds with 50+ agents and 200+ tasks
- [ ] No unhandled errors in console during normal operation
- [ ] All API endpoints validate input and return proper error responses
- [ ] Metrics charts update in real-time

---

## 10. Detailed TODOs

### Phase 1 TODOs

#### 1.1 Project Initialization
- [ ] Create Next.js 15 app with `create-next-app --typescript --tailwind --app --src-dir=false`
- [ ] Install dependencies: `drizzle-orm better-sqlite3 @tanstack/react-query zustand next-intl recharts zod`
- [ ] Install shadcn/ui and add components: Button, Card, Badge, Dialog, Input, Select, Table, Tabs, Tooltip, DropdownMenu, Sheet
- [ ] Configure `drizzle.config.ts` pointing to `./data/agents-office.db`
- [ ] Set up path aliases in `tsconfig.json` (`@/` -> root)

**Acceptance**: `npm run dev` compiles without errors, shadcn/ui components render.

#### 1.2 Database Schema & Seed
- [ ] Define Drizzle schema in `lib/db/schema.ts` matching Section 5 data model
- [ ] Generate and run initial migration
- [ ] Write `lib/db/seed.ts` that reads `master-config.json`, `team-config.json`, `agents-persona.json` and inserts into SQLite
- [ ] Create npm script `db:seed` that runs the seed

**Acceptance**: Running `npm run db:seed` creates populated SQLite DB. Querying `agents` table returns 10+ rows.

#### 1.3 API Routes
- [ ] `GET /api/projects` -- list all projects with agent counts
- [ ] `POST /api/projects` -- create new project
- [ ] `GET /api/projects/[id]` -- project detail with agents and recent tasks
- [ ] `PATCH /api/projects/[id]` -- update project status/config
- [ ] `GET /api/projects/[id]/agents` -- list agents for project
- [ ] `POST /api/projects/[id]/agents` -- create agent under project
- [ ] `GET /api/agents/[id]` -- agent detail with tasks and activity
- [ ] `PATCH /api/agents/[id]` -- update agent status/config
- [ ] `DELETE /api/agents/[id]` -- soft-delete (set inactive)

**Acceptance**: All endpoints return correct JSON. Tested with curl or API client.

#### 1.4 Dashboard Pages
- [ ] Main dashboard (`/`): MasterAgentBanner, StatsOverview (project/agent/task counts), ProjectCard grid, ActivityFeed stub
- [ ] Project detail (`/projects/[id]`): Left sidebar with AgentTree, center with TaskBoard stub, right panel with AgentDetailCard
- [ ] Agent detail (`/projects/[id]/agents/[agentId]`): AgentProfile, SkillsChart (bar chart of skill levels), stats, task history

**Acceptance**: Navigation between all 3 pages works. Data loads from SQLite via API. Korean text displays correctly.

#### 1.5 i18n Setup
- [ ] Create `lib/i18n/messages/ko.json` with all UI strings in Korean
- [ ] Create `lib/i18n/messages/en.json` with English translations
- [ ] Configure next-intl middleware for locale detection
- [ ] Add LanguageToggle component to header

**Acceptance**: Toggling language switches all visible text. Default is Korean.

---

## 11. Success Criteria (Overall)

1. **All 3-4 projects visible** from the main dashboard with real-time status
2. **Agent hierarchy** renders correctly: Master -> PM -> Agents per project
3. **Agent CRUD** works: create new agent with role/skills, edit, deactivate
4. **Task lifecycle** tracked: create -> assign -> in_progress -> completed/failed
5. **Workflow execution** visualized as step pipeline with live progress
6. **Korean language** is the default UI language with English toggle
7. **Data persists** in SQLite across server restarts
8. **Real-time updates** via SSE show agent status changes without page refresh (Phase 3+)
9. **Runs locally** with `npm run dev` -- no cloud dependencies for MVP

---

## 12. Risk Factors

| Risk | Mitigation |
|------|------------|
| Claude Code CLI integration complexity | Phase 3 is isolated; Phases 1-2 work with manual status updates. Mock the bridge for early testing. |
| SQLite concurrency limits | Single-user dashboard, so contention is minimal. Use WAL mode. |
| Scope creep into pixel-art visualization | Explicitly deferred to Phase 4 optional. Dashboard is the priority. |
| next-intl Korean font rendering | Use system Korean fonts (Noto Sans KR from Google Fonts) early in Phase 1. |
| Existing code coupling | Clean rebuild in new directory structure. Existing `dashboard/` folder is archived, not modified. |

---

## 13. Open Decisions for User

1. **Project addition**: Should the dashboard support adding new projects beyond the initial 3, or is it fixed to the known projects (auto-details, btc-stacking-bot, convengers)?
2. **Agent templates**: Should there be a library of pre-built agent templates (designer, debugger, researcher, etc.) or should every agent be configured from scratch?
3. **Notification preferences**: Should the dashboard send desktop notifications when an agent completes a task or encounters an error?
4. **Data export**: Should there be an export feature for task reports (CSV/PDF)?
5. **Pixel-art view**: Is the Phaser.js office visualization still desired as an optional view mode, or should it be dropped entirely?
