# WIP

## 현재 상태

기준 커밋: `ef30359 feat: implement bungae frontend screens`

모션 구조 교체와 다이얼로그·로컬 상태 전환 작업은 구현 및 검증을 마쳤고, 현재 워킹 트리에 커밋되지 않은 상태로 남아 있다.

완료된 구현:

- 목적지 화면 하나만 렌더링하는 incoming-only 라우트 전환
- `push` / `pop` / `tab` / `sheet` / `replace` 전환 intent
- history entry index 기반 browser back=`pop`, forward=`push` 판별
- pathname+search route identity와 query/hash history 정책
- 확정된 Next navigation에서만 intent를 기록하는 `NavigationLink`
- 경량 navigation intent store 분리
- 루트 화면 밖의 persistent bottom navigation과 Motion active mark
- `/filters`에서도 마운트를 유지하되 modal 배경으로 비활성화되는 하단 탭바
- Radix 기반 filter sheet 및 공통 `AnimatedDialog`
- filter/dialog focus trap, initial focus, Escape/backdrop dismiss, exit 후 focus 복원
- filter switch thumb와 list/result layout motion
- destructive confirm의 dialog exit 후 상태 변경·navigation
- Reduced Motion의 route/sheet/dialog/layout/CSS/press transition 비활성화
- 프로필·연결·차단·미달 결정·연결 성립 화면의 dialog/layout motion
- URL query를 첫 client render부터 반영하고 cold HTML에는 중립 fallback을 사용하는 query 화면
- 미달 인원 쿼리 부재 시 `2명 → 0명`으로 바뀌던 버그 수정

## 검증 결과

- `npm test -- --reporter=dot`: 15 files, 60 tests 통과
- `npm run typecheck`: 통과
- `npm run lint`: 통과
- `npm run build`: 통과
- `git diff --check`: 통과
- production build 홈 First Load JS 관측값: 107 kB
- Reduced Motion 통합 테스트에서는 preference 활성화를 알리는 Motion 개발용 warning 1건이 출력됨

390×844 Chromium QA:

- route surface, bottom navigation, active mark가 각각 1개로 유지됨
- tab=`tab`, filter=`sheet`, visual back link=`pop`
- 괄호 안 숫자를 history entry index로 두고 `root(0) → detail(1) → 화면의 뒤로가기 링크로 root(2) → browser back detail(1/pop) → forward root(2/push)` 확인
- push 화면의 하단 탭바 exit와 fixed CTA viewport 하단 고정 확인
- filter에서 하단 탭바 DOM은 유지되지만 `aria-hidden` + `inert`로 비활성화됨
- filter initial focus, focus containment, Escape exit 후 홈 이동 확인
- dialog Escape dismiss와 destructive confirm exit 후 row/result commit 및 focus 이동 확인
- 가로 overflow 0, filter sheet 390×594, clipping 문제 없음
- Reduced Motion에서 route/sheet transform `none`, sheet/press duration `0s`, result/disclosure animation `none`
- 확인한 화면에서 runtime console error 없음

## 후속 작업

알려진 요구사항과 위 검증 범위에서 구현 작업은 남아 있지 않다. 현재 변경은 unstaged 상태로 보존한다.

커밋은 사용자가 요청할 때 아래처럼 분리한다.

1. `feat: rebuild app navigation motion`
   - `motion`, navigation intent/history, persistent bottom navigation, filter sheet, Reduced Motion, 관련 테스트
2. `feat: animate dialogs and local state changes`
   - Radix dialog primitive, profile/connections/blocks/quorum/matched layout motion, 관련 테스트

커밋 전:

```bash
git diff --check
git status --short
git diff --stat
git diff --cached --stat
```

푸시는 사용자가 별도로 요청할 때만 수행한다.
