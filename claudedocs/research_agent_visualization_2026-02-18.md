# Research Report: Agent Activity Character Visualization

> Date: 2026-02-18
> Depth: Deep
> Query: "팀 에이전트의 업무 진행을 캐릭터로 시각화해서 보여주는 오픈소스"

---

## Executive Summary

에이전트 활동을 픽셀 아트/도트 캐릭터로 시각화하는 오픈소스를 조사한 결과, **AI Town (a16z)**이 가장 적합한 베이스 프로젝트로 확인되었습니다. 9,200+ stars, MIT 라이선스, PixiJS 기반 2D 렌더링으로 이미 캐릭터 이동/상태 시스템이 구축되어 있습니다.

---

## TIER 1: Best Matches (캐릭터 기반 시각화)

### 1. AI Town (a16z-infra) - RECOMMENDED
- **GitHub**: https://github.com/a16z-infra/ai-town
- **Stars**: 9,200+
- **핵심**: 픽셀 아트 타운에서 AI 캐릭터들이 자율적으로 이동, 대화, 작업 수행
- **기술 스택**: TypeScript, PixiJS, Convex, React, Next.js
- **적합도**: HIGH - 캐릭터 스프라이트 시스템, 타일맵, 실시간 상태 업데이트 이미 구현됨
- **적용 방안**: Fork 후 소셜 로직을 실제 에이전트 태스크 오케스트레이션으로 교체

### 2. Stanford Generative Agents (Smallville)
- **GitHub**: https://github.com/joonspk-research/generative_agents
- **Stars**: 20,600+
- **핵심**: 25개 AI 에이전트가 픽셀 아트 RPG 마을에서 생활
- **기술 스택**: Python (백엔드), Phaser.js (프론트엔드)
- **적합도**: MEDIUM-HIGH - 시각화 레이어 우수하나 백엔드 수정 많이 필요

### 3. ChatDev (OpenBMB)
- **GitHub**: https://github.com/OpenBMB/ChatDev
- **Stars**: 29,100+
- **핵심**: 가상 소프트웨어 회사 (CEO, CTO, Programmer, Tester 등 역할 기반)
- **기술 스택**: Python, Flask (visualizer)
- **적합도**: MEDIUM - 역할 기반 구조가 우리 유스케이스와 유사, 스프라이트 레이어 추가 필요

### 4. MetaGPT / MGX
- **GitHub**: https://github.com/FoundationAgents/MetaGPT
- **Stars**: 31,400+
- **핵심**: AI 소프트웨어 회사, 에이전트 간 실시간 커뮤니케이션 시각화
- **적합도**: MEDIUM - 워크플로우/그래프 기반, 픽셀 아트 레이어 추가 필요

### 5. AI-Tamago
- **GitHub**: https://github.com/ykhli/AI-tamago
- **Stars**: 800+
- **핵심**: LLM 기반 가상 펫 (감정 상태, 상호작용)
- **적합도**: MEDIUM - 가상 펫 → 가상 팀으로 확장 가능

---

## TIER 2: Rendering Libraries (직접 구축 시)

| 라이브러리 | 용도 | 특징 |
|-----------|------|------|
| **PixiJS** | 2D WebGL 렌더링 | AI Town에서 사용, 스프라이트/타일맵 지원 |
| **Phaser.js** | HTML5 게임 프레임워크 | Stanford Agents에서 사용, 물리엔진 내장 |
| **DiceBear** | 픽셀 아트 아바타 생성 | 이미 agents-persona.json에서 사용 중 |
| **Ink** | React for Terminal | Node.js TUI, 터미널 기반 시각화 |
| **Asciimatics** | 터미널 ASCII 애니메이션 | Python, ASCII 스프라이트 이동 |

---

## TIER 3: Observability Tools (보완용)

| 도구 | GitHub | 용도 |
|------|--------|------|
| **AgentPrism** | evilmartians/agent-prism | OpenTelemetry 기반 에이전트 트레이싱 UI |
| **Langfuse** | langfuse/langfuse (10k+ stars) | LLM 관찰 플랫폼, 비용/토큰 추적 |

---

## Recommended Architecture

### Option A: AI Town Fork (Fastest)
1. a16z-infra/ai-town Fork
2. 소셜 행동 로직 → 실제 에이전트 태스크 오케스트레이션 교체
3. 에이전트 상태(idle, working, reviewing, blocked) → 캐릭터 애니메이션 매핑
4. 기존 PixiJS 렌더링, 타일맵, 캐릭터 이동 시스템 재활용

### Option B: Custom Build (Most Flexible)
1. PixiJS 또는 Phaser.js로 2D 렌더링 레이어
2. DiceBear pixel-art로 에이전트별 고유 아바타 자동 생성
3. WebSocket으로 실시간 에이전트 상태 수신
4. 타일 기반 "오피스"에서 캐릭터가 태스크에 따라 이동

### Option C: Terminal-Based (Lightweight)
1. Ink (Node.js) 또는 Rich/Textual (Python)
2. 유니코드/이모지 캐릭터로 에이전트 표현
3. Asciimatics로 ASCII 캐릭터 애니메이션

---

## Confidence Level
- **HIGH**: AI Town이 가장 적합한 베이스 프로젝트
- **MEDIUM**: 직접 구축 시 PixiJS + DiceBear 조합 추천
- **LOW**: 완전한 기성 솔루션은 존재하지 않음 (커스터마이징 필요)

---

## Sources
- [AI Town](https://github.com/a16z-infra/ai-town)
- [Stanford Generative Agents](https://github.com/joonspk-research/generative_agents)
- [ChatDev](https://github.com/OpenBMB/ChatDev)
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT)
- [AI-Tamago](https://github.com/ykhli/AI-tamago)
- [PixiJS](https://pixijs.com/)
- [Phaser.js](https://phaser.io/)
- [DiceBear](https://www.dicebear.com/styles/pixel-art/)
- [AgentPrism](https://github.com/evilmartians/agent-prism)
- [Langfuse](https://github.com/langfuse/langfuse)
