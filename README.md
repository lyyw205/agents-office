# Agents Office

> AI Agent Team Dashboard - 여러 프로젝트의 AI 에이전트 팀을 하나의 대시보드에서 관리

Claude Code 기반의 AI 에이전트 팀을 프로젝트별로 구성하고, 픽셀아트 시각화와 함께 실시간으로 모니터링하는 대시보드입니다.

## Architecture

```
agents-office/
├── dashboard/          # React + Vite + Phaser.js (port 5173)
│   ├── src/
│   │   ├── components/ # UI 컴포넌트 (agent, task, workflow, phaser)
│   │   ├── pages/      # Dashboard, Project, Agent 페이지
│   │   ├── hooks/      # useApi, useSSE, useSimulationTime
│   │   ├── store/      # Zustand (agentStore, simulationEngine)
│   │   ├── i18n/       # 한국어/영어 (ko.json, en.json)
│   │   └── lib/        # API client, utilities
│   └── public/         # Phaser assets (characters, tilesets, map)
├── server/             # Hono + SQLite/Drizzle (port 3001)
│   └── src/
│       ├── db/         # Schema, migrations, seed
│       ├── routes/     # REST API (projects, agents, tasks, workflows, activity, sse)
│       ├── bridge/     # Claude CLI subprocess manager (process-pool, watchdog)
│       ├── sse/        # Server-Sent Events broadcast
│       ├── middleware/  # Error handler, request logger
│       └── lib/        # Graceful shutdown
├── projects/           # 프로젝트별 에이전트 설정 (JSON)
├── scripts/            # 설치/설정 스크립트
└── master-config/      # 공유 설정
```

## Tech Stack

**Dashboard**
- React 18, TypeScript, Vite
- Phaser 3 (픽셀아트 에이전트 시각화)
- TanStack Query (서버 상태 관리)
- Zustand (클라이언트 상태)
- Tailwind CSS
- react-i18next (한/영 전환)
- react-router-dom v7
- react-toastify

**Server**
- Hono (HTTP framework)
- better-sqlite3 + Drizzle ORM
- SSE (Server-Sent Events) 실시간 푸시
- Agent Bridge (Claude CLI subprocess pool)

## Quick Start

```bash
# 1. Install dependencies
cd server && npm install
cd ../dashboard && npm install

# 2. Start server (seeds DB on first run)
cd server
npm run db:seed
npm run dev          # http://localhost:3001

# 3. Start dashboard
cd dashboard
npm run dev          # http://localhost:5173
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (DB, Bridge, SSE status) |
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get project detail |
| GET | `/api/projects/:id/agents` | List project agents |
| POST | `/api/projects/:id/agents` | Create agent |
| GET | `/api/agents/:id` | Get agent detail |
| PATCH | `/api/agents/:id` | Update agent |
| DELETE | `/api/agents/:id` | Deactivate agent |
| POST | `/api/agents/:id/clone` | Clone agent |
| GET | `/api/tasks` | List tasks (`?project_id=`) |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task |
| POST | `/api/tasks/:id/execute` | Execute task via Claude CLI |
| GET | `/api/workflows` | List workflows (`?project_id=`) |
| PATCH | `/api/workflows/:id` | Update workflow |
| GET | `/api/activity` | Recent activity log |
| GET | `/api/sse/stream` | SSE event stream |
| GET | `/api/saved-configs` | List saved agent presets |
| POST | `/api/saved-configs` | Save agent preset |

## Features

- **Multi-Project Dashboard**: 여러 프로젝트를 카드 형태로 한눈에 확인
- **Agent Management**: 에이전트 생성/수정/복제/비활성화, 프리셋 저장
- **Task Board**: 태스크 생성, 상태 관리, 에이전트 할당, Claude CLI 실행
- **Workflow Pipeline**: 워크플로우 단계별 진행률 시각화
- **Activity Feed**: 실시간 활동 로그 (상태 변경, 태스크 이벤트)
- **SSE Real-Time**: 연결 상태 표시, 이벤트 기반 자동 갱신
- **Pixel Art Visualization**: Phaser.js 기반 에이전트 캐릭터 시각화
- **i18n**: 한국어/영어 전환
- **Agent Bridge**: Claude CLI 서브프로세스 풀 (최대 3개 동시), Watchdog 타임아웃
- **Graceful Shutdown**: SIGTERM 시 브릿지 정리 + DB 연결 종료

## Development Progress

- [x] Phase 1: Foundation (DB, API, Phaser, Routing, Agent CRUD)
- [x] Phase 2: Task Management, Workflows, Activity Feed
- [x] Phase 3: Agent Bridge, SSE Real-Time, Error Handling
- [x] Phase 4: Polish + Production Hardening

## License

MIT
