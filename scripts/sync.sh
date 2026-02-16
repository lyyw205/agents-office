#!/bin/bash

# Claude Agents Hub - GitHub 동기화 스크립트
# 변경사항을 GitHub와 동기화합니다.

set -e

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 현재 스크립트의 디렉토리
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HUB_DIR="$( dirname "$SCRIPT_DIR" )"

# 사용법 출력
usage() {
    echo "Usage: $0 {push|pull|status}"
    echo ""
    echo "Commands:"
    echo "  push   - 로컬 변경사항을 GitHub에 푸시"
    echo "  pull   - GitHub에서 변경사항을 가져오기"
    echo "  status - Git 상태 확인"
    exit 1
}

# 인자 확인
if [ $# -eq 0 ]; then
    usage
fi

COMMAND=$1

cd "$HUB_DIR"

# Git 저장소 확인
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Git 저장소가 초기화되지 않았습니다.${NC}"
    echo ""
    echo -e "${BLUE}다음 명령으로 초기화하세요:${NC}"
    echo "  git init"
    echo "  git add ."
    echo "  git commit -m 'Initial commit'"
    echo "  git remote add origin <your-github-repo-url>"
    echo "  git push -u origin main"
    exit 1
fi

case "$COMMAND" in
    push)
        echo -e "${BLUE}📤 GitHub에 변경사항 푸시 중...${NC}"
        echo ""

        # Git 상태 확인
        if [ -z "$(git status --porcelain)" ]; then
            echo -e "${GREEN}✓ 변경사항 없음${NC}"
            exit 0
        fi

        # 변경된 파일 표시
        echo -e "${BLUE}변경된 파일:${NC}"
        git status --short
        echo ""

        # 커밋 메시지 입력
        echo -e "${YELLOW}커밋 메시지를 입력하세요 (기본: 'Update agent configs'):${NC}"
        read -r COMMIT_MSG
        if [ -z "$COMMIT_MSG" ]; then
            COMMIT_MSG="Update agent configs"
        fi

        # Git 작업
        git add .
        git commit -m "$COMMIT_MSG"
        git push

        echo ""
        echo -e "${GREEN}✓ 푸시 완료!${NC}"
        ;;

    pull)
        echo -e "${BLUE}📥 GitHub에서 변경사항 가져오는 중...${NC}"
        echo ""

        # 로컬 변경사항 확인
        if [ -n "$(git status --porcelain)" ]; then
            echo -e "${YELLOW}⚠ 로컬에 커밋되지 않은 변경사항이 있습니다.${NC}"
            echo -e "${YELLOW}  stash하거나 커밋한 후 다시 시도하세요.${NC}"
            echo ""
            git status --short
            exit 1
        fi

        # Pull 실행
        git pull

        echo ""
        echo -e "${GREEN}✓ Pull 완료!${NC}"
        echo ""
        echo -e "${BLUE}설치 스크립트를 실행하여 스킬을 동기화하세요:${NC}"
        echo -e "  ${BLUE}./scripts/install.sh${NC}"
        ;;

    status)
        echo -e "${BLUE}📊 Git 상태:${NC}"
        echo ""
        git status
        echo ""
        echo -e "${BLUE}최근 커밋:${NC}"
        git log --oneline -5
        ;;

    *)
        usage
        ;;
esac
