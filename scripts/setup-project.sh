#!/bin/bash

# Claude Agents Hub - 새 프로젝트 설정 스크립트 (3-tier hierarchy)
# 새 프로젝트의 팀 에이전트 구성을 생성합니다.

set -e

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 사용법 출력
usage() {
    echo "Usage: $0 <project-name>"
    echo ""
    echo "Example:"
    echo "  $0 my-awesome-project"
    exit 1
}

# 인자 확인
if [ $# -eq 0 ]; then
    usage
fi

PROJECT_NAME=$1
PM_AGENT_ID="${PROJECT_NAME}-pm"

# 현재 스크립트의 디렉토리
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HUB_DIR="$( dirname "$SCRIPT_DIR" )"
PROJECT_DIR="$HUB_DIR/projects/$PROJECT_NAME"
MASTER_CONFIG="$HUB_DIR/master-config/master-config.json"

echo -e "${BLUE}🚀 새 프로젝트 설정 (3-tier hierarchy): $PROJECT_NAME${NC}"
echo ""

# 프로젝트 디렉토리 생성
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}⚠ 프로젝트가 이미 존재합니다: $PROJECT_NAME${NC}"
    exit 1
fi

mkdir -p "$PROJECT_DIR"
echo -e "${GREEN}✓${NC} 디렉토리 생성: $PROJECT_DIR"

# 1. team-config.json 템플릿 생성 (WITH HIERARCHY)
cat > "$PROJECT_DIR/team-config.json" <<'TEAMEOF'
{
  "projectName": "PROJECT_NAME",
  "description": "프로젝트 설명을 입력하세요",
  "version": "1.0.0",
  "repository": "https://github.com/YOUR_USERNAME/PROJECT_NAME",
  "technology": ["TypeScript", "Node.js"],

  "hierarchy": {
    "tier": "project",
    "masterAgent": "master-orchestrator",
    "pmAgent": {
      "id": "PM_AGENT_ID",
      "name": "PROJECT_NAME 프로젝트 매니저",
      "role": "PROJECT_NAME 프로젝트 총괄",
      "responsibilities": [
        "전체 워크플로우 조율",
        "팀 에이전트 작업 할당 및 모니터링",
        "마스터 에이전트와의 소통",
        "스케줄 및 리소스 관리"
      ],
      "reportsTo": "master-orchestrator",
      "modelTier": "high"
    }
  },

  "teamAgents": {
    "pm": [
      {
        "name": "PM_AGENT_ID",
        "role": "프로젝트 매니저",
        "source": "oh-my-claudecode",
        "responsibilities": [
          "전체 팀 조율",
          "마스터 에이전트 소통",
          "워크플로우 모니터링",
          "팀원 작업 할당"
        ],
        "priority": "critical",
        "modelTier": "high",
        "reportsTo": "master-orchestrator"
      }
    ],
    "core": [
      {
        "name": "executor",
        "role": "코드 구현 실행자",
        "source": "oh-my-claudecode",
        "responsibilities": [
          "코드 작성 및 파일 생성",
          "자동화 스크립트 실행"
        ],
        "priority": "critical",
        "modelTier": "medium",
        "reportsTo": "PM_AGENT_ID"
      }
    ],
    "support": []
  },

  "skills": {
    "essential": [],
    "optional": []
  },

  "workflows": [],

  "quickCommands": {
    "build": "autopilot: 빌드 실행",
    "test": "ralph: 테스트 실행"
  },

  "customAgents": {
    "planned": []
  },

  "metrics": {
    "totalAgents": 2,
    "pmAgents": 1,
    "coreAgents": 1,
    "supportAgents": 0,
    "totalSkills": 0,
    "workflows": 0,
    "estimatedSetupTime": "5분",
    "lastUpdated": "CURRENT_DATE"
  }
}
TEAMEOF

# 치환
sed -i "s/PROJECT_NAME/$PROJECT_NAME/g" "$PROJECT_DIR/team-config.json"
sed -i "s/PM_AGENT_ID/$PM_AGENT_ID/g" "$PROJECT_DIR/team-config.json"
sed -i "s/CURRENT_DATE/$(date +%Y-%m-%d)/g" "$PROJECT_DIR/team-config.json"

echo -e "${GREEN}✓${NC} team-config.json 생성 (hierarchy 포함)"

# 2. pm.md 생성
cat > "$PROJECT_DIR/pm.md" <<EOF
# $PROJECT_NAME Project Manager Agent
# $PROJECT_NAME 프로젝트 관리 에이전트

## 1. Overview

**Name**: $PM_AGENT_ID
**Project**: $PROJECT_NAME
**Tier**: Tier-2 (Project Manager)
**Reports To**: Master Orchestrator
**Status**: Active

## 2. Core Responsibilities

### 2.1 Team Leadership
- 팀 에이전트 관리 및 조율
- 일일 팀 상황 파악
- 성과 평가 및 피드백

### 2.2 Workflow Orchestration
- 워크플로우 관리 및 추적
- 작업 일정 수립
- 에이전트 간 협력 조율

### 2.3 Communication
- Master Orchestrator에 상태 보고
- 팀 에이전트 작업 할당 및 진행 모니터링

## 3. Team Structure

\`\`\`
$PM_AGENT_ID
└── Core
    └── executor (코드 실행)
\`\`\`

## 4. Decision Authority

- 팀 내 작업 순서 결정
- 에이전트별 스킬 활용 결정
- 품질 기준 설정 및 검증
- Master 승인 필요: 에이전트 추가, 일정 변경, 기술 스택 변경
EOF

echo -e "${GREEN}✓${NC} pm.md 생성"

# 3. agents-persona.json 생성
cat > "$PROJECT_DIR/agents-persona.json" <<PERSONAEOF
{
  "agents": [
    {
      "id": "$PM_AGENT_ID",
      "name": "프로젝트 매니저",
      "emoji": "👔",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=$PM_AGENT_ID",
      "role": "프로젝트 총괄 관리자",
      "department": "Management",
      "personality": {
        "traits": ["조율", "리더십", "책임감"],
        "workStyle": "팀 중심",
        "motto": "팀의 성공이 나의 성공"
      },
      "specialties": ["워크플로우 조율", "팀 관리", "리소스 배분"],
      "backstory": "여러 프로젝트를 성공적으로 이끈 경험 많은 프로젝트 매니저",
      "stats": {
        "projectsCompleted": 0,
        "successRate": 100,
        "avgResponseTime": "2.0s"
      },
      "reportsTo": "master-orchestrator"
    },
    {
      "id": "executor",
      "name": "실행자",
      "emoji": "⚡",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=executor-$PROJECT_NAME",
      "role": "코드 실행 전문가",
      "department": "Engineering",
      "personality": {
        "traits": ["효율적", "실용적", "빠름"],
        "workStyle": "결과 중심",
        "motto": "말보다 행동"
      },
      "specialties": ["코드 작성", "파일 시스템 관리", "자동화"],
      "backstory": "실행력이 뛰어난 엔지니어",
      "stats": {
        "projectsCompleted": 0,
        "successRate": 100,
        "avgResponseTime": "1.8s"
      },
      "reportsTo": "$PM_AGENT_ID"
    }
  ],
  "teams": {
    "pm": ["$PM_AGENT_ID"],
    "core": ["executor"],
    "support": []
  }
}
PERSONAEOF

echo -e "${GREEN}✓${NC} agents-persona.json 생성"

# 4. workflows.md 템플릿 생성
cat > "$PROJECT_DIR/workflows.md" <<EOF
# $PROJECT_NAME 워크플로우

## 워크플로우 1: 기본 작업

\`\`\`mermaid
graph LR
    PM[$PM_AGENT_ID] --> A[시작]
    A --> B[executor: 실행]
    B --> C[PM: 검증]
    C --> D[완료]
\`\`\`

### 역할 분담

| 순서 | 에이전트 | 스킬 | 책임 |
|------|---------|------|------|
| 0 | $PM_AGENT_ID | - | 작업 할당 및 조율 |
| 1 | executor | - | 작업 실행 |
| 2 | $PM_AGENT_ID | - | 결과 검증 |

**예상 소요 시간**: 10분
**병렬 처리**: 불가

---

## 실행 명령어

\`\`\`bash
# 기본 작업
autopilot: 작업 수행
\`\`\`
EOF

echo -e "${GREEN}✓${NC} workflows.md 생성"

# 5. README.md 생성
cat > "$PROJECT_DIR/README.md" <<EOF
# $PROJECT_NAME - 팀 에이전트 구성

## 개요

**프로젝트**: $PROJECT_NAME
**PM Agent**: $PM_AGENT_ID
**Reports To**: Master Orchestrator

## 3-Tier Hierarchy

\`\`\`
Master Orchestrator
└── $PM_AGENT_ID (Project Manager)
    └── executor (Core)
\`\`\`

## 팀 에이전트

- **PM**: 1명 ($PM_AGENT_ID)
- **Core**: 1명 (executor)
- **Support**: 0명
- **Total**: 2명

## 워크플로우

자세한 내용은 [workflows.md](workflows.md)를 참조하세요.

## PM Agent

자세한 내용은 [pm.md](pm.md)를 참조하세요.
EOF

echo -e "${GREEN}✓${NC} README.md 생성"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ 프로젝트 설정 완료 (3-tier hierarchy)!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}생성된 파일:${NC}"
echo -e "  • team-config.json (hierarchy 포함)"
echo -e "  • pm.md (PM Agent 정의)"
echo -e "  • agents-persona.json (PM + executor 페르소나)"
echo -e "  • workflows.md (PM 조율 워크플로우)"
echo -e "  • README.md"
echo ""
echo -e "${BLUE}다음 단계:${NC}"
echo ""
echo -e "1. team-config.json 편집 (에이전트 추가):"
echo -e "   ${BLUE}vim $PROJECT_DIR/team-config.json${NC}"
echo ""
echo -e "2. pm.md 커스터마이징:"
echo -e "   ${BLUE}vim $PROJECT_DIR/pm.md${NC}"
echo ""
echo -e "3. 변경사항 커밋:"
echo -e "   ${BLUE}./scripts/sync.sh push${NC}"
echo ""
