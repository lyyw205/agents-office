#!/bin/bash

# Claude Agents Hub - 설치 스크립트
# 모든 기기에서 실행하여 팀 에이전트 구성을 동기화합니다.

set -e

echo "🤖 Claude Agents Hub 설치 시작..."
echo ""

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Claude 스킬 디렉토리 생성
CLAUDE_SKILLS_DIR="$HOME/.claude/skills"
echo -e "${BLUE}📁 Claude 스킬 디렉토리 확인...${NC}"
mkdir -p "$CLAUDE_SKILLS_DIR"

# 현재 스크립트의 디렉토리
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HUB_DIR="$( dirname "$SCRIPT_DIR" )"

echo -e "${GREEN}✓${NC} Hub 디렉토리: $HUB_DIR"
echo ""

# 1. 공유 스킬 설치
echo -e "${BLUE}📦 공유 스킬 설치 중...${NC}"
SKILLS=(
    "web-artifacts-builder"
    "frontend-design"
    "playwright"
    "ui-designer"
)

for skill in "${SKILLS[@]}"; do
    SOURCE="$HUB_DIR/skills/$skill"
    TARGET="$CLAUDE_SKILLS_DIR/$skill"

    if [ -d "$SOURCE" ]; then
        # 심볼릭 링크가 이미 존재하면 제거
        if [ -L "$TARGET" ]; then
            rm "$TARGET"
        elif [ -d "$TARGET" ] && [ ! -L "$TARGET" ]; then
            # 실제 디렉토리가 존재하면 백업
            mv "$TARGET" "${TARGET}.backup.$(date +%Y%m%d%H%M%S)"
        fi

        # 심볼릭 링크 생성
        ln -s "$SOURCE" "$TARGET"
        echo -e "${GREEN}  ✓${NC} $skill"
    else
        echo -e "${YELLOW}  ⚠${NC} $skill (소스 없음, 건너뜀)"
    fi
done

echo ""

# 2. 프로젝트별 설정 확인
echo -e "${BLUE}📋 프로젝트 설정 확인...${NC}"
PROJECT_DIRS=(
    "auto-details"
    "btc-stacking-bot"
    "convengers"
)

for project in "${PROJECT_DIRS[@]}"; do
    PROJECT_DIR="$HUB_DIR/projects/$project"
    if [ -d "$PROJECT_DIR" ]; then
        echo -e "${GREEN}  ✓${NC} $project"

        # team-config.json 존재 확인
        if [ -f "$PROJECT_DIR/team-config.json" ]; then
            echo -e "    - team-config.json ✓"
        else
            echo -e "${YELLOW}    - team-config.json 없음${NC}"
        fi

        # workflows.md 존재 확인
        if [ -f "$PROJECT_DIR/workflows.md" ]; then
            echo -e "    - workflows.md ✓"
        else
            echo -e "${YELLOW}    - workflows.md 없음${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠${NC} $project (디렉토리 없음)"
    fi
done

echo ""

# 3. 대시보드 설치 (선택적)
echo -e "${BLUE}🎨 대시보드 설치...${NC}"
DASHBOARD_DIR="$HUB_DIR/dashboard"
if [ -d "$DASHBOARD_DIR" ]; then
    if [ -f "$DASHBOARD_DIR/package.json" ]; then
        echo -e "${GREEN}  ✓${NC} 대시보드 찾음"
        echo -e "    npm 의존성 설치 중..."
        cd "$DASHBOARD_DIR"
        npm install --silent > /dev/null 2>&1 && echo -e "${GREEN}  ✓${NC} 의존성 설치 완료" || echo -e "${YELLOW}  ⚠${NC} 의존성 설치 실패"
        cd - > /dev/null
    fi
else
    echo -e "${YELLOW}  ⚠${NC} 대시보드 디렉토리 없음"
fi

echo ""

# 4. oh-my-claudecode 확인
echo -e "${BLUE}🔍 oh-my-claudecode 확인...${NC}"
if command -v omc &> /dev/null; then
    OMC_VERSION=$(omc --version 2>/dev/null || echo "unknown")
    echo -e "${GREEN}  ✓${NC} omc 설치됨 (버전: $OMC_VERSION)"
else
    echo -e "${YELLOW}  ⚠${NC} omc 미설치"
    echo -e "    설치 명령: ${BLUE}npm install -g oh-my-claude-sisyphus${NC}"
fi

echo ""

# 5. 설치 완료 메시지
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Claude Agents Hub 설치 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}다음 단계:${NC}"
echo ""
echo -e "1. 대시보드 실행:"
echo -e "   ${BLUE}cd $DASHBOARD_DIR${NC}"
echo -e "   ${BLUE}npm run dev${NC}"
echo -e "   브라우저에서 ${BLUE}http://localhost:3000${NC} 열기"
echo ""
echo -e "2. 프로젝트에서 사용:"
echo -e "   ${BLUE}cd /path/to/your/project${NC}"
echo -e "   ${BLUE}/oh-my-claudecode:team 4:vision,designer,executor \"작업 설명\"${NC}"
echo ""
echo -e "3. 설정 확인:"
echo -e "   ${BLUE}ls -la $CLAUDE_SKILLS_DIR${NC}"
echo ""
echo -e "4. GitHub 동기화:"
echo -e "   ${BLUE}./scripts/sync.sh push${NC}  # 변경사항 푸시"
echo -e "   ${BLUE}./scripts/sync.sh pull${NC}  # 다른 기기에서 풀"
echo ""
