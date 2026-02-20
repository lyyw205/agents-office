# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
# Start both dashboard and server in dev mode (dashboard:5173, server:3001)
npm run dev

# Build (server first, then dashboard)
npm run build

# Run individual workspaces
npm run dev -w dashboard    # Vite dev server on :5173
npm run dev -w server       # tsx watch on :3001

# Database
npm run db:migrate          # Run Drizzle migrations
npm run db:seed             # Seed database from seed-data/ configs

# Lint (dashboard only)
npm run lint -w dashboard   # ESLint 9 flat config

# Type check
npx tsc --noEmit -p server/tsconfig.json
npx tsc -b -p dashboard/tsconfig.app.json --noEmit
```

No test suite is configured yet.

## Architecture

**Monorepo** with npm workspaces: `dashboard/` and `server/`.

### Server (`server/`)

Hono HTTP API with SQLite (better-sqlite3 + Drizzle ORM). ESM modules (`"type": "module"`), all imports use `.js` extensions.

- **Routes** (`src/routes/`): REST endpoints mounted at `/api/*` — projects, agents, tasks, workflows, activity, saved-configs, hooks, sse
- **Bridge** (`src/bridge/`): Claude CLI subprocess pool. Spawns `claude` processes for task execution with a FIFO queue, max concurrency (default 3), and a watchdog timer (default 5 min). Model tier maps: `high`→opus, `medium`→sonnet, `low`→haiku
- **SSE** (`src/sse/broadcast.ts`): Client registry + broadcast. Events: `task_updated`, `task_completed`, `agent_status`, `hook_activity`, `agent_communication`, `heartbeat`
- **Hooks** (`src/routes/hooks.ts`): Receives Claude Code hook events (SessionStart, PostToolUse, Stop) from an external reporter script (`~/.claude/hooks/agents-office-reporter.mjs`). Tracks sessions in memory with 5-min timeout, maps OMC agent roles to persona IDs
- **Middleware**: error handler (`AppError` class), request logger, rate limiter (200 req/min general, 10 req/min on task execute)
- **DB schema** (`src/db/schema.ts`): 7 tables — projects, agents, tasks, workflows, activity_log, saved_agent_configs, agent_communications. SQLite WAL mode, foreign keys enabled, 30-day auto-retention on activity tables

### Dashboard (`dashboard/`)

React 19 + Vite 7 + Tailwind CSS 4 + Phaser 3.

- **Pages** (`src/pages/`): DashboardPage (main 3-column layout), AgentPage (detail panel), MapEditorPage
- **Phaser** (`src/components/phaser/`): OfficeScene renders a pixel-art office with animated agent sprites, department zones, desk positions, communication lines, and status indicators. PhaserOffice.tsx is the React wrapper
- **Editor** (`src/components/editor/`): Tile-based map editor with 24 tilesets (Rasak), multi-layer painting, agent drag-drop. State in useEditorStore (Zustand)
- **State**: Zustand for UI state (sidebar, locale), TanStack Query for server state with SSE-driven invalidation
- **SSE** (`src/hooks/useSSE.ts`): EventSource with exponential backoff (1s–30s), buffers recent communications, invalidates TanStack Query caches on events
- **API client** (`src/lib/api.ts`): Typed fetch wrapper for all `/api/*` endpoints
- **i18n** (`src/i18n/`): Korean (default) and English via react-i18next

### Data Flow

```
Claude Code CLI → Hook Reporter (.mjs) → POST /api/hooks → agent_communications table
                                                          → SSE broadcast
                                                          → useSSE hook → Phaser viz + Activity feed
```

Scene config and agent overrides are auto-exported to `seed-data/` for git portability. Fresh DB init re-imports them via `db:seed`.

### Key Environment Variables (.env)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3001 | Server port |
| `CORS_ORIGINS` | localhost:5173,3000 | Allowed origins |
| `MAX_CONCURRENT_AGENTS` | 3 | Claude CLI process pool size |
| `TASK_TIMEOUT_MS` | 300000 | Per-task timeout (5 min) |
| `SCAN_PATHS` | ~/repos | External project sync scan paths |

### Production

Docker multi-stage build. Final image serves both API and dashboard static files from port 3001 via Hono's `serveStatic`.
