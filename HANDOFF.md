# HANDOFF

## Current [1771562721]
- **Task**: Dashboard v2 - Hook Activity System + Phaser Communication Visualization + Dashboard Redesign
- **Completed**:
  - Removed entire Sync system (sync routes, service, config, SyncPanel - 668 lines deleted)
  - Added `agent_communications` table + schema + DB indexes + 30-day retention
  - Hook-based activity tracking (`hooks.ts`): session start/end, tool activity (SendMessage/Task/TaskCreate/TaskUpdate)
  - `agents-office-reporter.mjs` hook registered in Claude Code settings (SessionStart, PostToolUse, Stop)
  - `agentAliases` mapping in master-config.json (OMC roles → persona IDs)
  - SSE reconnection with exponential backoff + `agent_communication` event capture
  - Phaser OfficeScene: communication visualization (connection lines with arrows, speech bubbles, glow pulse effects)
  - Activity type color coding (message=cyan, spawn=green, task_create=yellow, task_update=purple)
  - Dashboard redesign: Office View (3/5) + Agent Cards + Activity Feed (2/5) side-by-side layout
  - Agent Detail Panel: inline sidebar with skills, responsibilities, persona, recent tasks
  - Agent editing: name, role, department, emoji, display_alias (bidirectional mapping)
  - `resolveAgentId()` extended: matches by original_id, display_alias, and agent name
  - Git portability: auto-export scene_config → `seed-data/scene-config.json`, agent overrides → `seed-data/agent-overrides.json`
  - Seed imports exported customizations on fresh DB init
  - Tile palette: fixed horizontal scroll (auto-fill grid + overflow-x-hidden)
  - Seed data cleanup: only auto-details project, removed btc-stacking-bot/convengers
- **Next Steps**:
  - Test full hook flow end-to-end (start server → work in another project → verify dashboard shows activity)
  - Layer visibility toggle UI (eye icons per layer)
  - Zoom (mouse wheel → camera.setZoom)
  - Keyboard shortcuts (P=Paint, E=Erase, G=Grid)
  - Fill tool (flood fill)
- **Blockers**: None
- **Related Files**:
  - server/src/routes/hooks.ts (new)
  - server/src/lib/dashboard-export.ts (new)
  - server/src/routes/agents.ts
  - server/src/routes/projects.ts
  - server/src/routes/activity.ts
  - server/src/db/schema.ts
  - server/src/db/seed.ts
  - server/src/index.ts
  - dashboard/src/hooks/useSSE.ts
  - dashboard/src/components/phaser/OfficeScene.ts
  - dashboard/src/components/phaser/PhaserOffice.tsx
  - dashboard/src/components/common/Layout.tsx
  - dashboard/src/pages/DashboardPage.tsx
  - dashboard/src/types/index.ts
  - dashboard/src/lib/api.ts
  - dashboard/src/components/editor/TilePalette.tsx
  - ~/.claude/hooks/agents-office-reporter.mjs

## Past 1 [1771483684]
- **Task**: Interactive Office Map Editor (Phase 1 + Phase 2)
- **Completed**: Full tile-based map editor with 24 Rasak tilesets, 4-category palette, multi-layer painting, agent drag-and-drop, undo/redo, save to DB, dashboard consolidation, global office view
- **Note**: Editor + dashboard layout complete, all asset paths fixed

## Past 2 [1771466942]
- **Task**: Phase 4 - Polish + Production Hardening
- **Completed**: Dashboard recreated (React 19 + Vite + Tailwind v4 + Phaser.js), server hardening, Docker support, i18n, SSE real-time updates
- **Note**: All 5 pages built, API client typed, Phaser office visualization with agent sprites
