# 벙개 진행 요약 — 2026-09-21

## 현재 상태

저장소 안에서 해결 가능한 출시 차단 항목은 integration worktree에 구현·검증됐다. 이번
회차에서 누적 diff를 직접 리뷰해 발견 2건을 수정했고, 실제 QA backend에 붙여 브라우저
실 흐름 일부를 확인했다. 아직 push·merge되지 않았고, 실제 SMS·생성 수명주기·실기기
검증은 남아 있어 공개 출시 상태는 아니다.

## 1차 — 구현·수정한 핵심 작업

- `next.config.ts`에 `BUNGAE_API_ORIGIN` 검증과 same-origin `/v1/*` → backend `/api/v1/*` rewrite를 추가했다. credential·path·query·fragment가 포함된 origin은 fail-closed한다.
- 모임 상세에서 로그인한 뒤 원래 모임으로 복귀하도록 했고, 허용 경로를 `/meetups/<safe-id>`로 제한해 open redirect를 차단했다.
- backend detail의 전역 `JOIN` 값만 믿지 않고 `/me/meetups?relation=ALL`을 pagination해 실제 사용자 relation을 확인한다.
- 본인인증 시작 요청에 현재 origin의 `/profile` `returnUrl`을 JSON으로 전달하도록 UI→provider→session store→API client 계약을 연결했다.
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` 기본 보안 헤더를 추가했다.
- 실제 Next production server의 API rewrite를 검사하는 `scripts/api-proxy-smoke.mjs`와 `test:api-proxy`를 추가하고 CI build 뒤에 연결했다.
- `.env.example`, README, WIP, API 계약 참고 문서와 제품 완료 체크리스트의 오래된 API·실행 설명을 현재 구현 경계에 맞췄다.

## 2차 — 직접 리뷰와 수정 2건

리뷰는 별도 리뷰 도구를 쓰지 않고 누적 diff 22개 파일을 직접 읽어 수행했다.

- **수정 1 — 참여 취소 후 재참여 불가.** `activeJoinState.result`가 같은
  `sessionEpoch:subject:meetupId` 동안 유지돼, JOIN→LEAVE 뒤에는 새로고침 전까지 JOIN
  버튼이 다시 나오지 않았다. LEAVE 성공 시 join 상태를 초기화하고, JOIN 성공 시 남아
  있던 LEAVE 완료 문구를 지운다. 재참여는 `joinAttemptRef`가 이미 null이라 새
  Idempotency-Key로 나간다. 회귀 테스트는 수정 전 실패·수정 후 통과를 확인했다.
- **수정 2 — 잘못된 실패 문구.** relation 조회 실패가 상세 조회 실패와 같은 문구
  ("모임을 불러오지 못했어요.")로 보였다. relation 조회를 별도 `try`로 분리해
  "참여 여부를 확인하지 못했어요. 다시 시도해 주세요."로 표시하고, fail-closed
  (JOIN 미노출 + 재시도) 동작은 유지한다.
- **유지 판단 —** `relation`은 backend SQL에서 `HOST`/`PARTICIPANT`만 나오고 `LEFT`
  참여는 목록에서 제외되므로(`MeetupService.listMine`), 이탈 사용자가 JOIN을 잃는
  문제는 없다. 조회 실패를 `relation=null`로 뭉개면 오히려 중복 JOIN 버튼이
  되살아나므로 fail-closed를 유지했다.
- **유지 판단 —** 상세의 로그인 링크는 `encodeURIComponent`를 두 번 적용해
  `postAuthDestination`의 `[A-Za-z0-9_-]+` 검증과 어긋난다. 다만 경로 파라미터는
  backend `@PathVariable UUID`라 실제 값은 UUID뿐이고, 어긋나면 홈으로 fallback한다.

## 2차 — 실제 QA backend 실측 (합성 아님)

`ssh rapi-agent`는 Tailscale 추가 인증이 필요해 컨테이너에 접근하지 못했지만, QA API는
HTTPS로 살아 있었다.

- `GET https://bungae-qa.justn.me/api/v1/meetups` → `401 UNAUTHENTICATED` + `application/problem+json`.
- QA 계정 3종은 고정 QA 코드로 로그인된다(실 SMS 없음, 격리 DB).
- `GET /api/v1/me/meetups?relation=ALL`에서 QA-1·QA-3는 `PARTICIPANT`인데
  `GET /api/v1/meetups/{id}`의 `allowedActions`는 `['JOIN']`이다. 이번 diff가 우회하는
  "전역 JOIN" 결함이 실제 backend에 존재한다.
- 로컬 `next start`(`BUNGAE_API_ORIGIN=https://bungae-qa.justn.me`, `127.0.0.1:3210`)에
  Chromium 390×844로 접속해 익명 상세 → `/auth?next=%2Fmeetups%2Fec6f99c1-…` 링크 →
  QA-1 OTP 로그인 → **원래 모임 상세로 복귀** → 실제 서버 데이터 렌더
  (`QA participant browser check`, 장소 `망원한강공원 · 서울특별시 마포구`), action bar에
  **참여 취소만 노출되고 JOIN은 없음**을 확인했다. alert는 없다.
- 새로고침하면 익명 게이트로 돌아간다. access/refresh token이 메모리 전용이라 reload
  세션 유지는 설계상 성립하지 않는다(재로그인 전제로만 유지된다).
- `GET /api/v1/places/search?…` → `503 PLACE_PROVIDER_UNAVAILABLE`. QA 환경에는 장소
  provider 키가 없고 시드 모임은 1건이며 시작 시각(2026-09-14)이 지났다. 따라서
  생성→참가/대기→확정/취소→채팅→체크인→사후 전체 수명주기는 이 환경에서 실행할 수 없다.
- 로컬 http origin에서는 본인인증 시작이 성립하지 않는다. backend는 `returnUrl`이
  absolute `https`일 때만 201을 준다(`ProfileService.createVerificationSession`).

## 2차 — Next 16 ESLint 전환 측정 (미전환 판단)

`eslint-config-next@16.3.5`와 flat config(`eslint-config-next/core-web-vitals`,
`/typescript`)로 측정한 결과: **83 findings, 0 warnings, 35개 파일, 자동 수정 가능 0건**.

- `react-hooks/refs` 41
- `react-hooks/set-state-in-effect` 24
- `react-hooks/globals` 10
- `react-hooks/immutability` 7
- `react-hooks/purity` 1

자동 수정 가능 0건이고 전부 의미론적 React Compiler 규칙이라, 릴리스 차단 수정에 부분
전환을 섞으면 검증되지 않은 상태기계 리팩터가 된다. 전환은 landing하지 않고 측정값만
기록한다. `package.json`·`package-lock.json`은 그대로이며 `eslint-config-next`는
15.5.25로 복구했다(`npm ci`, lock hash `3fb5bdfe…` 동일).

## 2차 — 부수 정리 판단과 실행

- **`.gitignore`:** participant-flow가 추가한 `.env.local`은 기존 `.env*.local`이 이미
  포함하므로 중복이다. 실제로 빠져 있던 것은 QA 자격증명 파일
  `artifacts/qa/QA_ACCOUNTS.local.md` 하나뿐이라 그 줄만 추가했다. 이 worktree에는
  현재 `.env.local`이 없어 유출 사고는 아니고 예방 조치다.
- **QA 증거 이관:** `artifacts/qa/`는 main에 이미 11개 파일이 추적되는 저장소 관례다.
  participant-flow에만 있던 untracked 증거 65개(자격증명 1개 제외)를 이
  worktree로 옮겨 추적 대상으로 만든다. `QA_ACCOUNTS.local.md`는 옮기지 않았고
  `.gitignore`로 다시 차단했다. 이관 파일을 재검사해 QA 계정 전화번호 1건이 worker
  journal에 남아 있던 것을 `[redacted-qa-phone]`으로 치환했고, OTP 코드·토큰·키는
  발견되지 않았다.
- **출처 표기:** 옮긴 증거는 `codex/participant-flow-evidence`(base `de21c76`)에서
  2026-09-14에 수행한 QA의 산출물이며, 그 시점 코드는 이 worktree의 revision과 9개
  파일에서 다르다. 따라서 이 revision의 검증 증거가 아니라 참고 증거다.
- **worktree:** 제거한 worktree는 없다. `bungae-frontend-participant-flow`는 증거
  원본, `bungae-frontend-ps-evidence`는 untracked 사용자 파일, `bungae-frontend`는
  사용자 untracked 파일 때문에 보존했다. 이관이 끝난 뒤에도 삭제는 별도 승인 대상이다.
- **releaseId 추적:** 이 저장소에서 닫을 수 없다. frontend가 `X-Release-Id`를 보내도
  backend가 받아 기록·노출하지 않으면 추적이 성립하지 않는다. 장식용 헤더 추가는
  no-op이므로 하지 않았고, `BLOCKED` 상태를 유지한다.

## 직접 실행해 통과한 검증

- Vitest: **72 files / 558 tests passed** (리뷰 수정으로 +2)
- `npm run typecheck`: 통과 / `npm run lint`: 통과
- `BUNGAE_API_ORIGIN=… npm run build`: 통과
- `npm run test:api-proxy`: 통과 (POST method, `/api/v1` rewrite, query, JSON body, upstream status/header/body)
- Playwright: **77/77 passed** (Chromium·WebKit·Firefox + PWA Chromium, 익명/no-API 셸 범위)
- 원격 CI: run `35580303996` `verify` **success** (커밋 `ee6981c`, 6분 12초). 프론트 워크플로가 typecheck → lint → test → build → `test:api-proxy` → Playwright e2e를 원격 러너에서 실행한다.
- 독립 리뷰: `codex review --base main`(2026-09-21, model `gpt-5.6-terra`, medium) — 차단 finding 없음. 같은 실행에서 `typecheck`·`lint`·production `build`·`test:api-proxy`를 재실행해 통과했다.
- `git diff --check`: 통과. package-lock은 기준 revision과 동일.

## 미검증·외부 권한 또는 환경 차단

- 실제 휴대전화 SMS 수신과 성인·본인인증 provider redirect/callback(HTTPS 배포 필요)
- 실제 backend 생성→참가/대기→확정/취소→채팅→체크인→사후 전체 수명주기와 reload 유지
  (QA 환경은 장소 provider 미설정 + 시드 모임 1건 + 시작 시각 경과)
- connection 상세·1:1 메시지·realtime/reconnect·메시지 신고의 확정 backend 계약
- 실제 Push 등록·수신·클릭·해제, iOS/Android 설치, VoiceOver/TalkBack
- 원격 CI와 production deploy의 exact revision 성공, production smoke, rollback·DB 복원
- release 추적(위 판단)과 데이터 보존·삭제 정책
- 사람 QA는 **0건**이다. AI/browser 또는 기술 QA를 사람 QA로 계산하지 않는다.

## 증거 구분

- **로컬 코드 증거:** Vitest, typecheck, lint, production build, 77개 Playwright 회귀.
- **합성 런타임 증거:** disposable HTTP upstream + 로컬 `next start`를 이용한 API proxy smoke.
- **실제 backend 증거(2차 신규):** QA backend `https://bungae-qa.justn.me` + 실제 DB +
  Chromium 390×844에서 익명→OTP→모임 상세 복귀, relation 기반 action 노출 확인.
- **실제 운영 증거:** commit·push·merge와 production 배포를 이번 구현에서 수행했다(PR #6·#7·#8 → main `083d224`, Vercel production `bungae-review-main-20260906.vercel.app`). 운영 데이터 변경은 하지 않았다. 배포 후 `GET /` 200, `GET /v1/meetups` → 백엔드 `401 application/problem+json`(`instance=/api/v1/meetups`)로 rewrite와 `BUNGAE_API_ORIGIN`이 production에서 동작함을 확인했다. `Deploy production` 워크플로의 자동 실행은 `vercel pull` 단계에서 실패하며, 원인은 `VERCEL_TOKEN`의 team 접근 권한이다(저장소 비밀값 id·production 환경변수는 교정 완료).
