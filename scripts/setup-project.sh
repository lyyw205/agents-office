#!/bin/bash

# Claude Agents Hub - 새 프로젝트 설정 스크립트
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

# 현재 스크립트의 디렉토리
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HUB_DIR="$( dirname "$SCRIPT_DIR" )"
PROJECT_DIR="$HUB_DIR/projects/$PROJECT_NAME"

echo -e "${BLUE}🚀 새 프로젝트 설정: $PROJECT_NAME${NC}"
echo ""

# 프로젝트 디렉토리 생성
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}⚠ 프로젝트가 이미 존재합니다: $PROJECT_NAME${NC}"
    exit 1
fi

mkdir -p "$PROJECT_DIR"
echo -e "${GREEN}✓${NC} 디렉토리 생성: $PROJECT_DIR"

# team-config.json 템플릿 생성
cat > "$PROJECT_DIR/team-config.json" <<'EOF'
{
  "projectName": "PROJECT_NAME",
  "description": "프로젝트 설명을 입력하세요",
  "version": "1.0.0",
  "repository": "https://github.com/YOUR_USERNAME/PROJECT_NAME",
  "technology": ["TypeScript", "Node.js"],

  "teamAgents": {
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
        "modelTier": "medium"
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
    "totalAgents": 1,
    "coreAgents": 1,
    "supportAgents": 0,
    "totalSkills": 0,
    "workflows": 0,
    "estimatedSetupTime": "5분",
    "lastUpdated": "$(date +%Y-%m-%d)"
  }
}
EOF

# PROJECT_NAME 치환
sed -i "s/PROJECT_NAME/$PROJECT_NAME/g" "$PROJECT_DIR/team-config.json"

echo -e "${GREEN}✓${NC} team-config.json 생성"

# workflows.md 템플릿 생성
cat > "$PROJECT_DIR/workflows.md" <<EOF
# $PROJECT_NAME 워크플로우

## 워크플로우 1: 기본 작업

\`\`\`mermaid
graph LR
    A[시작] --> B[실행]
    B --> C[완료]
\`\`\`

### 역할 분담

| 순서 | 에이전트 | 스킬 | 책임 |
|------|---------|------|------|
| 1 | executor | - | 작업 실행 |

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

# README.md 생성
cat > "$PROJECT_DIR/README.md" <<EOF
# $PROJECT_NAME - 팀 에이전트 구성

## 개요

**프로젝트**: $PROJECT_NAME
**설명**: 프로젝트 설명을 입력하세요

## 팀 에이전트

- **Core**: 1명
- **Support**: 0명
- **Total**: 1명

## 스킬

- 아직 스킬이 추가되지 않았습니다.

## 워크플로우

자세한 내용은 [workflows.md](workflows.md)를 참조하세요.

## 사용 방법

\`\`\`bash
# team-config.json 편집
vim projects/$PROJECT_NAME/team-config.json

# 워크플로우 편집
vim projects/$PROJECT_NAME/workflows.md
\`\`\`

## 실행 예시

\`\`\`bash
autopilot: 작업 수행
\`\`\`
EOF

echo -e "${GREEN}✓${NC} README.md 생성"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ 프로젝트 설정 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}다음 단계:${NC}"
echo ""
echo -e "1. team-config.json 편집:"
echo -e "   ${BLUE}vim $PROJECT_DIR/team-config.json${NC}"
echo ""
echo -e "2. workflows.md 편집:"
echo -e "   ${BLUE}vim $PROJECT_DIR/workflows.md${NC}"
echo ""
echo -e "3. 변경사항 커밋:"
echo -e "   ${BLUE}./scripts/sync.sh push${NC}"
echo ""
