# Claude Agents Hub 사용 가이드

## 🎯 개요

Claude Agents Hub는 여러 프로젝트의 AI 팀 에이전트를 중앙에서 관리하고 시각화하는 시스템입니다.

---

## 📦 설치

### 1. 저장소 클론

```bash
git clone https://github.com/YOUR_USERNAME/claude-agents-hub.git
cd claude-agents-hub
```

### 2. 설치 스크립트 실행

```bash
./scripts/install.sh
```

이 스크립트는 다음을 수행합니다:
- ✅ `~/.claude/skills/`에 공유 스킬 심볼릭 링크 생성
- ✅ 프로젝트별 설정 확인
- ✅ 대시보드 의존성 설치
- ✅ oh-my-claudecode 설치 확인

---

## 🎨 대시보드 사용

### 대시보드 실행

```bash
cd dashboard
npm run dev
```

브라우저에서 `http://localhost:3000` 열기

### 대시보드 기능

1. **프로젝트 개요**
   - 총 프로젝트, 에이전트, 스킬, 워크플로우 통계
   - 프로젝트별 상세 정보

2. **프로젝트 상세**
   - 팀 에이전트 구성 (Core/Support)
   - 설치된 스킬 목록
   - 워크플로우 시각화 (Mermaid 다이어그램)
   - 빠른 실행 명령어

3. **스킬 라이브러리**
   - 공유 스킬 목록
   - 스킬별 사용 프로젝트
   - 설치 가이드

---

## 🤖 프로젝트에서 사용

### 기본 사용법

프로젝트 디렉토리에서 oh-my-claudecode 명령어 실행:

```bash
cd /path/to/your/project

# 팀 모드로 실행
/oh-my-claudecode:team 4:vision,designer,executor,code-reviewer "작업 설명"

# Autopilot 모드
autopilot: 작업 수행

# Ralph 모드 (끈기 모드)
ralph: 테스트 모두 통과시키기
```

### auto-details 예시

```bash
cd /home/youngwoo/repos/auto-details

# 1. Behance 스크래핑
/oh-my-claudecode:team 2:vision,executor "playwright로 Behance URL 스크래핑"

# 2. 레퍼런스 → 위젯 추출
/oh-my-claudecode:team 5:vision,designer,executor,code-reviewer "
1. ui-designer로 디자인 시스템 추출
2. web-artifacts-builder로 위젯 HTML 생성
3. code-reviewer로 품질 검증
4. 레지스트리 업데이트
"

# 3. 제품 → 상세페이지
autopilot: 제품명 "비타민C 세럼" 으로 상세페이지 생성, preset--ref-collagen 스타일 사용

# 4. 품질 검수
/oh-my-claudecode:ultrawork "output/ 폴더의 모든 위젯 품질 검사"
```

---

## 📝 새 프로젝트 추가

### 1. 프로젝트 설정 생성

```bash
./scripts/setup-project.sh my-new-project
```

### 2. team-config.json 편집

```bash
vim projects/my-new-project/team-config.json
```

**필수 수정 항목**:
- `description`: 프로젝트 설명
- `technology`: 사용 기술 스택
- `teamAgents.core`: 핵심 에이전트 추가
- `skills.essential`: 필수 스킬 추가
- `workflows`: 워크플로우 정의

### 3. workflows.md 편집

```bash
vim projects/my-new-project/workflows.md
```

Mermaid 다이어그램으로 워크플로우 시각화:

```markdown
## 워크플로우 1: 빌드 파이프라인

\`\`\`mermaid
graph TB
    A[소스 코드] --> B[빌드]
    B --> C[테스트]
    C --> D{통과?}
    D -->|Yes| E[배포]
    D -->|No| F[수정]
    F --> B
\`\`\`
```

### 4. GitHub에 푸시

```bash
./scripts/sync.sh push
```

---

## 🔄 GitHub 동기화

### 로컬 → GitHub (Push)

```bash
./scripts/sync.sh push
```

1. 변경된 파일 표시
2. 커밋 메시지 입력
3. 자동으로 add, commit, push

### GitHub → 로컬 (Pull)

```bash
./scripts/sync.sh pull
```

다른 기기에서:

```bash
git clone https://github.com/YOUR_USERNAME/claude-agents-hub.git
cd claude-agents-hub
./scripts/install.sh  # 스킬 심볼릭 링크 재생성
```

### Git 상태 확인

```bash
./scripts/sync.sh status
```

---

## 🛠️ 고급 사용법

### 커스텀 에이전트 추가

```json
{
  "customAgents": {
    "planned": [
      {
        "name": "my-custom-agent",
        "role": "특수 작업 전문가",
        "status": "planned",
        "priority": "high",
        "description": "특수 작업을 수행하는 커스텀 에이전트"
      }
    ]
  }
}
```

### 스킬 추가

```bash
# 1. 스킬 클론
cd skills
git clone https://github.com/AUTHOR/new-skill.git

# 2. 심볼릭 링크 생성
ln -s $(pwd)/new-skill ~/.claude/skills/new-skill

# 3. team-config.json에 추가
vim projects/MY_PROJECT/team-config.json
```

```json
{
  "skills": {
    "essential": [
      {
        "name": "new-skill",
        "source": "AUTHOR/new-skill",
        "version": "latest",
        "description": "스킬 설명",
        "priority": "critical"
      }
    ]
  }
}
```

### 워크플로우 병렬 실행

```json
{
  "workflows": [
    {
      "name": "parallel-review",
      "steps": [
        {
          "order": 1,
          "name": "보안 검사",
          "agent": "security-reviewer",
          "parallel": true
        },
        {
          "order": 1,
          "name": "성능 검사",
          "agent": "performance-reviewer",
          "parallel": true
        },
        {
          "order": 1,
          "name": "코드 검사",
          "agent": "code-reviewer",
          "parallel": true
        }
      ]
    }
  ]
}
```

실행:

```bash
/oh-my-claudecode:ultrawork "병렬 검수 실행"
```

---

## 📊 대시보드 커스터마이징

### 새 프로젝트 카드 색상

`dashboard/app/page.tsx` 수정:

```tsx
const projectColors = {
  'auto-details': 'from-purple-500 to-pink-500',
  'my-project': 'from-blue-500 to-cyan-500',
};
```

### 통계 위젯 추가

`dashboard/app/components/stats-widget.tsx` 생성:

```tsx
export function StatsWidget({ project }: { project: ProjectConfig }) {
  return (
    <div className="bg-white/5 rounded-xl p-4">
      <h3>{project.projectName}</h3>
      <p>Custom stats here</p>
    </div>
  );
}
```

---

## 🚨 문제 해결

### 심볼릭 링크 오류

```bash
# 심볼릭 링크 재생성
./scripts/install.sh
```

### 대시보드 빌드 오류

```bash
cd dashboard
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Git 충돌

```bash
# 로컬 변경사항 stash
git stash

# Pull
./scripts/sync.sh pull

# Stash 적용
git stash pop

# 충돌 해결 후 커밋
git add .
git commit -m "Resolve conflicts"
git push
```

---

## 📚 참고 자료

- [oh-my-claudecode 문서](https://github.com/Yeachan-Heo/oh-my-claudecode)
- [Claude Code 가이드](https://docs.anthropic.com/claude-code)
- [Mermaid 다이어그램](https://mermaid.js.org/)
- [Next.js 문서](https://nextjs.org/docs)

---

## 💡 팁

### 1. 프로젝트별 알리아스 설정

`.bashrc` 또는 `.zshrc`:

```bash
alias hub-auto='cd /home/youngwoo/repos/auto-details && /oh-my-claudecode:team'
alias hub-btc='cd /home/youngwoo/repos/btc-stacking-bot && /oh-my-claudecode:team'
alias hub-dash='cd /home/youngwoo/repos/claude-agents-hub/dashboard && npm run dev'
```

### 2. VS Code 통합

`.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Hub Dashboard",
      "type": "shell",
      "command": "cd dashboard && npm run dev",
      "problemMatcher": []
    }
  ]
}
```

### 3. 자동 동기화 (cron)

```bash
# 매일 오전 9시 자동 pull
0 9 * * * cd /home/youngwoo/repos/claude-agents-hub && ./scripts/sync.sh pull
```

---

## 🎉 다음 단계

1. ✅ 필수 스킬 설치 완료
2. ⬜ 대시보드 실행 및 확인
3. ⬜ 첫 번째 팀 에이전트 워크플로우 실행
4. ⬜ 새 프로젝트 추가
5. ⬜ GitHub에 푸시하여 다른 기기에서 테스트
