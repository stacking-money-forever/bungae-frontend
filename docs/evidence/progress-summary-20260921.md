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

## 3차 — 백엔드 재배포 (2026-09-22)

기존 QA 스택은 사용자가 제거했고(`rapi-agent:~/bungae-qa` 삭제, 컨테이너·볼륨 정리), 같은 호스트에
새 백엔드를 독립 스택으로 배포했다.

- 호스트: 당시 `rapi-agent`(pve VM 101) → `~/bungae-api` (2026-09-22에 pve VM 103으로 이관, 5차 참조)
- 스택(`name: bungae-api`): `bungae-api-api-1`(Spring Boot, `bungae-backend` `dfa7a2e`를 `bootJar`로
  빌드한 94MB jar), `bungae-api-postgres-1`(postgres:16.4-alpine), `bungae-api-redis-1`(redis:7.2.5),
  `bungae-api-tunnel-1`(`cloudflare/cloudflared:2026.8.2`). API는 `127.0.0.1:18084` 로컬 바인드만 한다.
- 새 Cloudflare 터널 `bungae-api`(`b8cec543-6175-475a-8166-91b20b1a8f95`) + DNS `bungae-api.justn.me`
  → `http://127.0.0.1:18084`. 기존 터널 `bungae-qa`와 그 자격증명은 삭제했다.
- 비밀값은 새로 생성했다: DB 비밀번호, `CURSOR_HMAC_KEY`, `AUTH_DESTINATION_ENCRYPTION_KEY`,
  `PUSH_TOKEN_ENCRYPTION_KEY`, `PUSH_TOKEN_FINGERPRINT_KEY`, RSA 2048 JWT 키페어(`file:` 리소스 경로로 마운트).
  provider는 전부 기본 비활성(`NHN_SMS_ENABLED`, `PORTONE_ENABLED`, `FCM_ENABLED`, `KAKAO_LOCAL_ENABLED`,
  `MINIO_ENABLED`, `OUTBOX_DISPATCHER_ENABLED` 모두 미설정).
- Flyway가 기동 시 migration 10건을 적용했고 activity policy `COFFEE`/`DINING`/`WALK`가 시드됐다.
- 실제 SMS·본인인증 provider가 없어 로그인이 불가능하므로, 이전 QA와 동일한 DB 측 affordance
  (`qa_login_allowlist` + OTP/PROFILE trigger, `qa-accounts.sql`/`create-accounts.py`)를 새 DB에 적용해
  고정 코드 로그인 3계정을 만들었다. **QA/staging DB 전용이며 production DB에 적용하면 안 된다.**
- 실측: `GET https://bungae-api.justn.me/api/v1/meetups` → `401 UNAUTHENTICATED`, QA-1 OTP `202` →
  로그인 `201`(`adultVerified`/`identityVerified` true) → `/me` `200` → activity-policies `200` → meetups 0건.
- 프론트 전환: Vercel 프로젝트 환경변수 `BUNGAE_API_ORIGIN=https://bungae-api.justn.me`를
  production·preview 양쪽에 `Config` 타입으로 설정하고 production을 재배포했다. 이제
  `https://bungae-review-main-20260906.vercel.app/v1/meetups`가 새 백엔드의 `401`을 반환한다.
- production 브라우저 실측(Chromium 390×844): 익명 홈 → `/auth` → QA-1 로그인 성공 → 인증된 홈이
  서버 상태로 렌더(`모임 0개`, 새 DB라 정직한 빈 상태). `/auth?next=/my-meetups`는 허용 경로가 아니라
  홈으로 fallback되는 것도 함께 확인됐다.
- 남은 정리: `bungae-qa.justn.me` DNS 레코드는 터널 삭제 후에도 남아 `530`을 반환한다(Cloudflare DNS
  삭제는 대시보드/API 토큰 필요, 이 Mac에 토큰 없음). 또한 시드 데이터가 없어 프론트에서 모임 생성은
  장소 provider(`KAKAO_LOCAL_ENABLED`)가 필요하고, provider 자격증명이 없으면 불가하다.

## 4차 — OTP 발송 공급자 (2026-09-22)

NHN Cloud는 2023-12-15 이후 가입한 개인 회원에게 SMS를 제공하지 않는다(공식 문서 확인). 사업자
계정 없이 실사용 로그인을 열기 위해 **Aligo 문자 API adapter를 backend에 구현**했다
(`bungae-backend` PR #1 → main `9aea875`).

- `ProviderClients.SmsSender` port + `AligoSmsClient`(form `key`/`user_id`/`sender`/`receiver`/`msg`/`msg_type=SMS`,
  `apis.aligo.in` host pin, 성공은 `result_code > 0`·`error_cnt = 0`·`msg_id` 존재).
- 공급자 선택은 `providers.sms.provider=nhn|aligo` 하나만. dispatcher가 켜졌는데 provider가 없거나
  두 공급자가 동시에 enabled면 startup 실패(silent fallback 금지).
- fixture `docs/providers/fixtures/aligo-sms.json`, surface `PRV-04`, 계약 문서 갱신. `./gradlew test`
  전체 통과(계약 테스트 포함). 빌드 jar를 `rapi-agent:~/bungae-api`에 재배포해 기동·`401` 확인.
- live 발송은 Aligo 계정 키와 등록 발신번호가 필요하다(`DEFERRED_CREDENTIAL_GATED`). 켤 때 넣을 값:
  `SMS_PROVIDER=aligo`, `ALIGO_SMS_ENABLED=true`, `ALIGO_SMS_KEY`, `ALIGO_SMS_USER_ID`,
  `ALIGO_SMS_SENDER_NUMBER`, `OUTBOX_DISPATCHER_ENABLED=true`. 개인 계정 API는 일 500건 제한이고,
  발송 접수(`result_code > 0`)는 수신 성공이 아니다.

## 5차 — 백엔드 호스트 이관 (2026-09-22)

`rapi-agent`에서 다른 곳으로 옮기기로 해서 **pve VM 103(`bungae-api`)** 로 이관했다. VM은 사용자의 전용
Proxmox 에이전트가 생성했고(4 vCPU / 8GB / 80GB, Ubuntu 24.04, Docker 29.8.1, swap 2GB, UTC, ufw
LAN-only SSH, Tailscale 미가입), 애플리케이션 배포는 내가 이어서 했다.

- 새 호스트: `bungae-api` / `192.168.0.10` (LAN). Mac은 다른 대역이라 `ssh -J pve justn@192.168.0.10`로 접근한다.
- 이관 내용: `app.jar`(Aligo adapter 포함), `compose.yml`, `cloudflared.yml`, `credentials.json`, `.env`,
  JWT 키페어, QA 시딩 스크립트 + **기존 PG 덤프 복원**(migration 10, `qa_login_allowlist` 3, `user_profile` 1, meetup 0).
- **터널·호스트명 유지**: 같은 터널 `bungae-api`(`b8cec543…`)를 새 VM에서 돌려 `bungae-api.justn.me`가 그대로다.
  DNS·Vercel 환경변수 변경 0. 전환은 구 호스트 스택 정지 → 새 호스트 기동 순서로 몇 초 내에 끝났다.
- 검증: 백엔드 공개 `401`, production 프록시 `401`, QA-1 로그인 `202→201`(인증 완료)→`/me` 200,
  **production 프록시 경유 QA-2 로그인 `202→201`**(Vercel → 새 VM 전체 경로).
- 운영: `~/bungae-api/backup.sh` + cron(매일 03:17 UTC, 7일 보관)로 `pg_dump`를 `~/bungae-api/backups`에 남긴다.
- 구 호스트: 컨테이너 정지(`docker compose stop`), 볼륨 `bungae-api_pgdata`는 확인용으로 보존. 정리는
  `cd ~/bungae-api && docker compose down -v && rm -rf ~/bungae-api`.

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
  Chromium 390×844에서 익명→OTP→모임 상세 복귀, relation 기반 action 노출 확인. 09-22에는 그 스택을 제거하고 `https://bungae-api.justn.me`(rapi-agent `~/bungae-api`)로 재배포했다.
- **실제 운영 증거:** commit·push·merge와 production 배포를 이번 구현에서 수행했다(PR #6·#7·#8 → main `083d224`, Vercel production `bungae-review-main-20260906.vercel.app`). 운영 데이터 변경은 하지 않았다. 배포 후 `GET /` 200, `GET /v1/meetups` → 백엔드 `401 application/problem+json`(`instance=/api/v1/meetups`)로 rewrite와 `BUNGAE_API_ORIGIN`이 production에서 동작함을 확인했다. 배포 경로는 Vercel Git 연동(`stacking-money-forever/bungae-frontend` public ↔ `bungae-review-main-20260906`, production branch `main`)으로 전환했고, 토큰 기반 `Deploy production` 워크플로는 비활성화 후 파일을 제거했다. org private repo는 Hobby 플랜에서 연동이 거부되어(`409 ... Upgrade to Pro`) 저장소를 public으로 전환했으며, 공개 전 히스토리 55개 커밋을 스캔해 키·토큰·실제 개인정보가 없음을 확인했다.
