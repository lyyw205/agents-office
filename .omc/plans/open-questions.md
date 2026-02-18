# Open Questions

## team-agent-dashboard - 2026-02-18 (Updated 2026-02-19)

- [x] **RESOLVED** (v2 Section 14): Dynamic project addition — YES, projects are dynamically addable from the dashboard UI. Phase 1 includes "Add New Project" button.
- [x] **RESOLVED** (User decision): No agent role templates — every agent configured from scratch. "Clone agent" and "save as preset" provided as convenience. See v2 Section 9.3.
- [x] **RESOLVED** (v2 Phase 4.3): Desktop notifications — deferred to Phase 4 UX refinement.
- [x] **RESOLVED** (v2 Phase 4.4): Data export — CSV export for tasks, agents, activity log in Phase 4.
- [x] **RESOLVED** (User decision + v2 Section 14): Phaser.js is a CORE feature, not optional. Integrated in Phase 1. OverviewScene + ProjectScene.
- [x] **RESOLVED** (v2 Section 1): Deployment target — purely local (`npm run dev`). SQLite is local-only. No cloud dependencies for MVP.
- [x] **RESOLVED** (v2 Phase 1.5): Agent persona data is editable from dashboard UI (agent create/edit form includes persona fields).
- [x] **RESOLVED** (v2 Section 6): Agent Bridge is fully automated — dashboard triggers, Agent Bridge daemon spawns Claude Code CLI, result returns via SSE. IPC via stdout-based JSON streaming.
