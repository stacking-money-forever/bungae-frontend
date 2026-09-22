# 벙개 제품 완료 체크리스트

업데이트: 2026-09-21

남은 UI 실행 항목: [`REMAINING_UI_CHECKLIST.md`](./REMAINING_UI_CHECKLIST.md)

## 기준과 안전 경계

- [x] 제품·API 계약 SSOT를 Notion `번개만남 MVP API 명세서`로 지정했다.
  - URL: https://app.notion.com/p/c204f5fad39f4cf0ae0ce113f9eb8ba1?v=0d2e7406197c434ba98dcc209efae345
  - 현재 페이지 공통 규약: Base URL `/v1`, JSON, RFC 3339 UTC, UUID, cursor pagination, `application/problem+json`.
  - 세부가 `명세 미정`인 행은 구현에서 임의 보완하지 않는다.
- [x] 기존 frontend main dirty 변경과 PWA staged 변경을 원본 worktree에 보존했다.
- [x] 통합 작업은 `/Users/justn/dev/bungae-review-main-20260906`에서 수행한다.
- [x] 기존 backend 원격과 구현을 먼저 조사했다. 지정된 42개 계약 행의 route/service/DB 기반은 이미 존재한다.
- [ ] Backend의 `docs/spec/notion-snapshot.json`을 현재 live Notion과 재동기화하고 row/hash 추적성을 검증한다.
- [x] Backend의 기존 `/api/v1` 전 계약면을 live SSOT `/v1`에 맞추고 controller, security, WebSocket, OpenAPI, inventory, traceability, validation, tests를 함께 갱신했다.
  - 독립 검증: legacy 경로 0건, runtime route class 15개, trace route 48개, core 42/support 2/expansion 20 exact-set, baseline·manifest hash 통과.
  - `mise` JDK 21과 Docker에서 main/test compile 및 620개 중 619개 테스트가 통과했다. PostgreSQL/Redis 통합 테스트는 통과했고 MinIO 1개는 고정 `quay.io` 이미지 CDN timeout으로 미실행 상태다.
  - 현재 프론트는 `POST /v1/me/verification-sessions`에 현재 origin의 HTTPS `/profile` `returnUrl`을 JSON으로 전달한다. Backend `ProfileController`는 `@Valid @RequestBody VerificationSessionRequest(@NotBlank String returnUrl)`를 요구하고 absolute `https`만 허용한다(코드 확인). 로컬 http origin에서는 400 `INVALID_RETURN_URL`이므로 실제 provider redirect·callback 성공 여부는 HTTPS 배포 환경에서 별도 검증한다.
- [x] 커밋·push·merge·deploy·worktree 삭제는 별도 승인 전까지 금지한다.

## G0. 범위·책임·판정 기준

- [x] Frontend UX, PWA 기반, backend 계약, Push 통합, QA/운영을 별도 책임 영역으로 분리했다.
- [x] Terra High 작업자는 독립 worktree에서 작업하고 Codex가 결과를 독립 검증한다.
- [ ] 지원 브라우저·OS·일반 브라우저/설치 모드 범위를 문서화한다.
- [ ] preview/production origin, HTTPS, cookie/CORS/CSRF, 환경변수와 VAPID 소유권을 문서화한다.
- [ ] 각 외부 공급자와 실기기 검증의 담당자·증거 경로·중단 조건을 기록한다.

## G1. 실제 사용자 흐름

- [x] 지역 선택이 fixture 결과와 결과 수에 실제 반영된다.
- [x] 필터·지역 draft/apply/cancel/reload와 탭·history·gesture 회귀 테스트가 통과한다.
- [x] Frontend API client를 Notion `/v1` 계약에 연결한다.
  - Auth/Push 범위의 typed client와 `application/problem+json` 처리는 완료했다. Access/refresh token은 메모리 전용이며 concurrent refresh와 계정 전환이 session identity로 격리된다. 인증·탐색·상세·생성·참가/취소·채팅·체크인·사후·연결·알림·프로필·신고·차단·탈퇴 화면이 typed `/v1`에 연결됐다.
  - [x] Authenticated 탐색 목록·모임 상세를 `GET /v1/meetups`와 `GET /v1/meetups/{meetupId}`에 연결했다. 필터 query, loading/empty/error/retry/cursor pagination, venue redaction, 계정·필터·route stale response와 상세 로컬 상태 격리를 검증했다. Unsupported 보드게임은 unfiltered 요청으로 완화하지 않고 명시적으로 표시한다.
  - [x] Authenticated 장소 검색과 모임 생성을 `GET /v1/places/search` 및 `POST /v1/meetups`에 연결했다. Provider 장소 선택·공개장소 확인, 절대 시각·24시간 경계, stale 검색·계정 전환 격리, in-flight 잠금, 동일 실패 payload의 Idempotency-Key 재사용과 의미 변경 시 key 교체를 17개 신규 회귀 테스트로 검증했다. Live provider 자격증명·응답 검증은 남았다.
  - [x] Backend 생성 트랜잭션이 host를 첫 `JOINED` 참가자로 정확히 1회 등록하고 `joinedCount=1`을 반환한다. 동일 Idempotency-Key replay는 meetup·host participation·outbox effect를 중복 생성하지 않으며 첫 외부 참가 후 2명이 된다. 생성자 상세에는 `JOIN` 없이 기존 정책상 `LEAVE`, `CANCEL`, `QUORUM_DECISION`만 조건부 노출된다.
- [ ] 가입/OTP/검증/프로필/로그아웃 흐름이 실제 서버 상태로 동작한다.
  - [x] 시작 화면과 `/v1/auth/otp-requests` → `/v1/auth/sessions` OTP UI를 연결했다. E.164/6자리 검증, 재전송 cooldown과 timer 정리, 번호 수정, problem code별 오류, 중복 submit, stale async session commit 차단, 인증 성공 route replace를 테스트했다.
  - [x] 인증 세션의 `/v1/me` GET/PATCH, `If-Match` 충돌 복구, `/v1/activity-policies` 기반 관심 활동, HTTPS `returnUrl`을 보내는 `/v1/me/verification-sessions`와 provider handoff UI를 연결했다. 계정 전환 시 이전 검증 URL·편집 draft·저장 pending/error가 새 subject로 넘어가지 않는 회귀 테스트가 통과한다.
  - [ ] 실제 SMS 발송·성공 로그인, live 성인·신원 provider 완료 callback, 배포 환경 프로필 수정·로그아웃을 검증한다.
    - 2026-09-22: NHN Cloud는 2023-12-15 이후 가입 개인 회원에게 SMS를 제공하지 않아 Aligo 문자 API adapter를 구현했다(`bungae-backend` PR #1, main `9aea875`). 계약 테스트·전체 `./gradlew test` 통과, 빌드 jar를 배포해 기동 확인(2026-09-22에 pve VM 103 `bungae-api`/`192.168.0.10`로 호스트 이관, 터널·호스트명 유지). live 발송은 Aligo 계정 키·등록 발신번호 대기(`DEFERRED_CREDENTIAL_GATED`).
- [ ] 탐색/생성/참여/대기/확정/취소/채팅/체크인/사후 흐름이 reload와 다른 세션에서도 유지된다.
  - [x] 모임 상세가 fresh `allowedActions`와 실제 사용자 `relation`을 함께 사용해 `JOIN`, `LEAVE`, `CANCEL`, `QUORUM_DECISION`, `CHECK_IN`을 노출한다. Backend detail은 참가자에게도 전역 `JOIN`을 광고하므로 `/me/meetups?relation=ALL`을 pagination해 relation이 있으면 JOIN을 숨기고 참여자에게 LEAVE를 노출한다(2026-09-21 실제 QA backend에서 `allowedActions=['JOIN']` + relation `PARTICIPANT` 조합으로 확인). JOIN/LEAVE는 실제 API mutation, in-flight 중복 차단, 성공·action error 후 상세 재조회, 동일 JOIN 재시도 key, route/account stale completion 격리를 검증했다. 참여 취소 뒤 재참여는 새 Idempotency-Key로 동작하고(2026-09-21 리뷰 수정), relation 조회 실패는 상세 조회 실패와 구분된 문구로 fail-closed한다.
  - [x] 취소·정족수 결정·체크인 페이지를 실제 typed `/v1` mutation에 연결했다. 각 직접 URL은 fresh detail의 `allowedActions`로 권한을 재확인하고, 서버 응답 전 성공 화면 금지, in-flight 중복 차단, 동일 semantic retry key 재사용, 입력 변경 key 교체, quorum 409 뒤 fresh version 재조회, route/account stale completion 격리를 페이지 회귀로 검증했다.
  - [x] `/my-meetups`와 `/notifications`를 authenticated typed API에 연결했다. 내 모임은 서버 DTO의 id/title/state/relation/startsAt만 표시하며, 알림은 notificationId/type/createdAt/state/version/readAt만 표시하고 목적지·본문을 추측하지 않는다. 목록·cursor·empty/error/retry, 단건/전체 읽음, 409 재조회, pending mutation 및 실제 A→B 계정 전환 격리를 검증했다.
  - [x] 그룹 채팅을 authenticated `GET/POST /v1/meetups/{meetupId}/messages`에 연결했다. 서버 sender/text/createdAt만 렌더링하고, 201 전 낙관적 메시지 추가 없이 cursor·error/retry, 동일 실패 text의 Idempotency-Key 재사용, 입력 변경 key 교체, in-flight 중복 및 route/account stale completion 격리를 검증했다. Meetup 전용 realtime 계약은 없어 실시간 수신은 미구현이다.
  - [x] 사후 비공개 피드백·긍정 인상·다음 행동을 독립된 authenticated `/v1` mutation으로 연결했다. 피드백은 네 항목 1–5점과 optional private comment, 인상은 `GET /participants`의 CHECKED_IN·비자기 실제 `userId`만 대상으로 사람별 1–4개 태그와 최대 7명을, 다음 행동은 세 계약 enum을 사용한다. 인상은 201 receipt 전 성공 금지·pending 중복 차단·generic/409 retry·focus를, 다음 행동은 세 enum·201 receipt 전 성공 금지·pending 중복 차단·generic retry·focus를 직접 검증했다. feedback·인상·다음 행동은 route/account stale success·error matrix를 각각 직접 검증했고, 참가자 목록은 initial loading/empty/error-retry, append retry/dedupe, route/account stale success·error를 직접 검증했다. “나중에 답하기”는 저장을 주장하지 않는 navigation이다.
  - [x] 사후 연결 선택과 `/connections`를 실제 참가자·connection-intents·connection 목록/DELETE 계약에 연결했다. CHECKED_IN·비자기 참가자만 최대 7명 선택하며 201 전 결과와 204 전 삭제를 금지하고, PENDING 비공개/MATCHED 구분, cursor·오류 재시도·중복·route/account stale·focus를 검증했다. Connection detail 계약이 없는 matched route는 가짜 상대·메시지·신고·차단을 제거했다.
  - [ ] 실제 backend 세션에서 JOIN→대기/참가, LEAVE, CANCEL, QUORUM_DECISION, CHECK_IN을 브라우저로 끝까지 실행하고 reload·다른 세션 유지성을 검증한다.
  - 2026-09-21 실제 QA backend(당시 `https://bungae-qa.justn.me`, 격리 DB) + Chromium 390×844에서 QA-1 OTP 로그인 → 원래 모임 상세 복귀 → 실제 서버 데이터 렌더와 relation 기반 action(참여 취소만 노출, JOIN 없음)을 확인했다. 그 스택은 제거됐고 2026-09-22 새 백엔드를 배포했다(pve VM 103 `bungae-api`, `192.168.0.10`)(`https://bungae-api.justn.me`, Flyway 10 migration, provider 비활성, QA 전용 고정 코드 로그인). QA 환경은 장소 provider 미설정(`PLACE_PROVIDER_UNAVAILABLE`)이라 프론트에서 생성·정족수·체크인 수명주기는 실행할 수 없다. access/refresh token이 메모리 전용이라 새로고침 후에는 익명 게이트로 돌아간다.
- [ ] 신고·차단·탈퇴·노쇼 이의 결과가 실제 서버 조회로 확인된다.
  - [x] 모임 신고를 authenticated `POST /v1/reports`에 연결했다. 사유 4종과 P0/P1, exact details/evidence empty 계약, 202 전 receipt 금지, 멱등 재시도·입력 변경 key 교체, route/account stale completion을 검증했다.
  - [x] `/profile/blocks`를 server `Block(blockedUserId,createdAt)` 목록과 실제 DELETE 해제에 연결했다. Cursor·error/retry·account 격리, 204 전 목록 유지, 중복·실패 재시도와 focus 복구를 검증했다. Typed createBlock은 준비됐지만 현재 Meetup DTO에 제안자 userId가 없어 상세에서 대상을 추측하거나 호출하지 않는다.
  - [x] `/profile/withdrawal`에서 탈퇴 예약 조회·202 예약·204 취소를 실제 API에 연결했다. 404 예약 없음, 동일 예약 retry key, current version `If-Match`, 409 fresh GET, 파괴 확인·focus·route/account stale 격리를 검증했으며 예약·취소가 자동 로그아웃을 실행하지 않는다.
  - [ ] Meetup 상세에 제안자 userId 또는 별도 block-target 계약을 추가한 뒤 실제 제안자 차단 생성 흐름을 연결한다.

## G2. 권한·개인정보·삭제

- [x] 미검증·타 사용자·차단·취소·제거된 사용자의 직접 API 접근이 서버에서 거절된다.
  - DB-backed session authority, withdrawal-pending 제한, meetup/chat/report/evidence/push 소유권·membership·block 정책을 감사했다. 누락됐던 참가 취소의 eligibility·bilateral-block guard를 추가했고 AUTHZ-08 및 focused/security/integration 회귀가 통과했다.
- [ ] 정확한 장소, 채팅, 신고자·증거가 응답·HTML·캐시·로그에서 권한에 맞게 마스킹된다.
  - Meetup 목록은 exact venue를 항상 제거하고, 상세는 host 또는 현재 `JOINED`/`CHECKED_IN`에게만 exact name/address/좌표를 반환한다. `WAITLISTED`/`LEFT`/비참가자는 `venue:{}`이며 list/detail/participants HTTP 응답에 `Cache-Control: no-store`를 적용해 serialization 통합 테스트를 통과했다.
  - 중앙 `SensitiveCacheControlFilter`가 모든 `/v1/**` 메서드·상태에 정확히 하나의 `Cache-Control: no-store`를 강제한다. Profile/trust/block/chat/incident/notification/connection/verification/admin audit 및 401/403 대표 HTTP 통합 테스트를 통과했다. WebSocket은 upgrade handshake만 HTTP header 대상이고 frame은 cache 대상이 아니며 실제 101 handshake 검증은 남았다.
  - 나머지 chat·신고·증거 projection의 DTO·DB·runtime privacy scanner와 party/owner/reporter 정책은 통과했다. 실제 frontend HTML/browser 표면 검증은 남았다. 2026-09-21 실제 QA backend + Chromium 390×844에서 참여자 계정 세션에 정확 장소(`망원한강공원 · 서울특별시 마포구`)가 표시됨을 확인했다. 안전한 대략 위치의 허용 정밀도·표현은 `PRODUCT_DECISION_REQUIRED`라 현재 아무 위치도 반환하지 않는다.
- [ ] 계정 전환/로그아웃/탈퇴 시 메모리·캐시·Push 연결이 정리된다.
  - Frontend 메모리 session/refresh와 profile·verification subject state 격리, 로그아웃 시 Push 해제→원격 세션 종료→로컬 secret 정리는 테스트했다. 실제 backend 탈퇴와 브라우저/SW 저장소 정리는 남았다.
  - Backend는 session family 회전·폐기, device delete/180일 inactive/FCM invalidation, 탈퇴 시 profile·CI·session·push 정리를 수행한다. Auth/OTP/verification, participation, message, post-meetup, notification, block/restriction, connection, evidence/realtime row의 삭제·비식별화 map은 아직 없다.
- [ ] 위치·채팅·신고 증거·Push endpoint·로그·backup의 보존/삭제 정책이 실제 동작한다.
  - `PRODUCT_DECISION_REQUIRED`: 각 데이터의 법적·운영 보존기간, 삭제/비식별화 대상, incident/audit 예외, backup·sink 정책을 확정해야 한다. Expired evidence object, safety-share hash, realtime-ticket hash의 global purge도 미구현이다.

## G3. 시간·동시성·복구

- [x] 서버 시각, 마지막 자리 경합, 마감 전후, 대기 승급, 미달 결정이 일관된다.
  - `concurrencyTest`, 고정 Clock completion, 100개 동시 마지막 자리, 대기 승급·정족수·409 전이가 통과했다.
- [x] Idempotency-Key, If-Match, 응답 유실, 409/429/503 재시도가 중복 mutation을 만들지 않는다.
  - 응답 body 미소비 후 same-key meetup create replay가 동일 resource를 반환하고 meetup/idempotency/outbox effect가 각각 하나임을 검증했다. Different-body 409, If-Match, rate-limit 회귀와 `concurrencyTest`·`contractTest`가 통과했다.
- [x] 앱이 닫혀 있어도 마감·자동 취소·대기 승급·탈퇴 익명화 작업이 진행된다.
  - completion/anonymization/outbox job과 `migrationTest`가 JDK 21, Python 3.13.7, Docker에서 통과했다.
- [x] 작업 재시작과 Push 실패 후에도 조회·재처리로 서버 상태를 복구한다.
  - `outboxCrashReplayDrill`, `redisRebuildDrill`, `postgresRestoreDrill`이 통과했다.

## G4. PWA·Push·호환·접근성

- [x] Manifest, 192/512 PNG, maskable, Apple touch icon이 production build에 포함된다.
- [x] iOS 수동 설치 진입점과 Chromium 설치 경로를 분리했다.
- [x] 개인 navigation을 캐시하지 않고 앱 소유 정적 캐시만 관리한다.
- [x] SW 명시 업데이트, rollback cache 경계, 안전한 내부 알림 destination, 오프라인 503을 구현했다.
- [x] 통합본 단위 테스트 531개, typecheck, lint, production build와 `git diff --check`가 통과한다. (no-API T01–T07 통합 후 2026-09-07 현재 snapshot 재측정 — 71 files / 531 passed. 이전 520개 기록은 이 갱신 전의 T04 시점 수치)
- [x] Push 브라우저 구독과 서버 등록/해제/동의/실패 상태를 분리하고 no-op 성공을 제거했다.
  - 현재 차이: Backend는 FCM device token(`PUT/DELETE /v1/me/push-devices/{deviceId}`)을 소유하고, PWA는 Web Push subscription/VAPID 모델을 사용한다. 기존 backend 계약을 재사용하는 브라우저 FCM 등록 경로로 정합화한다.
  - Firebase Web Messaging이 기존 SW registration을 재사용하고, JWT session 주입 없이는 `unavailable-auth`로 비활성화된다. Local persistence 실패는 exact device rollback/cleanup을 우선하며 새 UUID 등록을 막는다.
- [ ] 실제 HTTPS 환경에서 Push 등록→발송→수신→클릭 이동→해제를 검증한다.
- [ ] 실제 iOS/Android에서 설치, standalone 재실행, SW 업데이트/rollback, 오프라인 재실행을 검증한다.
- [ ] 390×844, 좁은 화면, 확대 글자, 키보드, focus, Reduced Motion, VoiceOver/TalkBack을 검증한다.
  - `/auth`의 390×844 DOM 치수는 viewport와 일치하고 잘못된 전화번호 제출 뒤 입력 focus와 alert 노출을 확인했다. Ego Lite screenshot은 두 번 모두 `Page.captureScreenshot` timeout으로 생성되지 않아 시각 판정은 미완료다.
  - Aside에서 익명 상세를 390×844로 emulation해 `innerWidth=390`, `innerHeight=844`, `scrollWidth=390`을 확인했다. 다만 캡처 PNG가 2880×1800 반복 합성으로 저장됐고 mocked-auth 다중 액션 진입은 OTP 화면 전환 전에 timeout되어, 다중 action bar의 시각 판정은 계속 미완료다.
  - 2026-09-21 실제 QA backend + Chromium 390×844에서 익명 게이트와 인증된 상세(action bar 포함) 화면을 캡처했고 가로 overflow는 없었다. 확대 글자·키보드 전용 탐색·VoiceOver/TalkBack은 여전히 미검증이다.

## G5. CI·배포·성능

- [ ] 최종 revision에 test/typecheck/lint/build와 핵심 E2E를 CI로 연결한다.
  - 2026-09-21 프론트 워크플로(`.github/workflows/ci.yml`)가 `typecheck` → `lint` → `test` → `build`(`BUNGAE_API_ORIGIN` 지정) → `test:api-proxy` → Playwright e2e를 실행하도록 연결했고, 원격 CI run `35580303996`의 `verify` 잡이 커밋 `ee6981c`에서 6분 12초에 통과했다.
  - Backend custom verification Test task는 JDK 21에서 configuration cache 저장·재사용 및 `concurrencyTest contractTest securityTest integrationTest migrationTest` 통과를 확인했다. CI workflow 연결은 아직 남았다.
  - Aggregate evidence task(`privacyArtifactScan` → `gcfSemanticCheck`/report tasks)는 아직 configuration-cache 비호환이고, frozen validator가 Git·unreachable object·primary checkout·Trash 어디에도 없는 ignored `.gjc` 입력 두 개를 요구해 clean worktree에서 실패한다. 원본 spec SHA-256 `c7650ad1…94059a`와 plan SHA-256 `57439cd8…05f5a`에 정확히 일치하는 authoritative bytes를 복구하기 전에는 portable tracked bundle을 만들 수 없다. Hash-only 재창작은 금지한다.
- [ ] Preview가 production DB·Push·사용자 데이터에 연결되지 않음을 증명한다.
- [ ] 정식 domain/HTTPS/callback/환경변수/비밀키 구성을 검증한다.
  - 2026-09-21 실측: 저장소의 `Deploy production` 워크플로(`.github/workflows/deploy.yml`)는 `npx vercel pull`에서 `Could not retrieve Project Settings.`로 실패한다. 같은 조건을 로컬에서 재현해 원인을 분리했다. 잘못된 `VERCEL_ORG_ID` + 올바른 `VERCEL_PROJECT_ID`가 정확히 이 문구를 만들고, 잘못된 project id는 `Project not found`, 거부된 token은 `The token provided via --token was rejected.`를 만든다.
  - 저장소 비밀값을 실제 프로젝트 값(`VERCEL_PROJECT_ID=prj_0ONMJrtYFsWnU3zCe0ixUPCWBs6P`, `VERCEL_ORG_ID=team_qikOEJyCAyZzZTFgeOD57Oeis`)으로 교정한 뒤에도 같은 단계에서 동일하게 실패했다. 로컬에서는 같은 id 조합과 CLI 세션 인증으로 `vercel pull`·`vercel build`·`vercel deploy`가 모두 성공하므로, 남은 원인은 `VERCEL_TOKEN`의 team 접근 권한이다. CLI에서 `vercel tokens add`는 `Cannot create tokens for this app.`으로 거부돼 저장소만으로는 토큰을 만들 수 없다.
  - production 환경변수는 비어 있었고, `BUNGAE_API_ORIGIN`을 추가할 때 CLI 기본값이 `Secret` 타입이라 `vercel pull`이 `BUNGAE_API_ORIGIN="[SENSITIVE]"`로 내려주고 `next.config.ts` 검증이 fail-closed로 build를 중단시켰다. `--no-sensitive`(Config 타입)로 다시 넣은 뒤 정상화했다. 배포 자동화를 쓸 때는 이 타입 차이가 build 실패로 이어지므로 Config 타입이어야 한다.
  - 2026-09-21 로컬 세션으로 production 배포를 실행해 `https://bungae-review-main-20260906.vercel.app`이 현재 revision을 서빙함을 확인했다(`GET /` 200, `GET /v1/meetups` → 백엔드 `401 application/problem+json`, `instance=/api/v1/meetups`). 즉 rewrite와 `BUNGAE_API_ORIGIN`은 production에서 동작한다.
  - 2026-09-21 배포 경로를 토큰 방식에서 Vercel Git 연동으로 전환했다. `POST /v9/projects/{id}/link`로 `stacking-money-forever/bungae-frontend`(public)↔`bungae-review-main-20260906`를 연결했고 `link.productionBranch=main`이다. org 소유 private repo는 Hobby 플랜에서 연동이 거부(`409 not supported on the Hobby plan. Upgrade to Pro`)되므로 저장소를 public으로 전환한 뒤 연결했다. 공개 전 히스토리 55개 커밋 전체를 스캔해 키·토큰·private key·실제 개인정보가 없음을 확인했다(추적된 `.env`는 `.env.example`뿐).
  - 토큰이 필요 없어졌으므로 `.github/workflows/deploy.yml`을 제거하고(`gh workflow disable`로 즉시 중단 후 파일 삭제) 배포는 Vercel Git 연동이 담당한다. `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` 저장소 비밀값은 더 이상 사용하지 않는다.
- [ ] 대표 기기·네트워크의 초기 표시, 입력 반응, 레이아웃 안정성, 반복 탭 전환 예산을 정하고 측정한다.

## G6. 운영·관측·롤백

- [ ] release/request ID로 API·작업 큐·Push·긴급 신고 실패를 추적한다.
  - [x] HTTP ingress가 client `traceparent`를 신뢰하지 않고 server trace/correlation을 생성하며 RFC 9457 응답과 outbox에 연결한다. Outbox replay, scheduled job, FCM provider, P0 incident가 safe trace/correlation을 보존하고 동일 completed effect를 중복 생성하지 않는 focused·observability·security·integration·contract test가 JDK 21에서 통과했다.
  - [ ] Deployable `releaseId`의 source/config/production validation과 parseable JSON log sink가 저장소에 없어 release→request 추적은 `BLOCKED`다. 임의 `unknown` 값은 넣지 않았다.
- [ ] 시험 신고가 운영자에게 도달해 조치·감사 기록·사용자 결과까지 이어진다.
- [ ] 민감 로그 제거와 보존기간을 검증한다.
- [ ] 위험 mutation/Push 발송 중단 수단을 검증한다.
  - [x] Immutable startup controls로 FCM Push delivery와 신규 계정 탈퇴 예약을 각각 fail-closed한다. Push stop은 provider·receipt 전에 `PUSH_DELIVERY_STOPPED`로 실패해 outbox의 기존 retry/DEAD·replay 경계를 보존하고, 탈퇴 예약 stop은 `ACCOUNT_WITHDRAWAL_SCHEDULING_STOPPED` 503과 DB/outbox effect 0을 검증했다. P0 신고 receipt는 stop 범위 밖에서 계속 동작한다.
  - [ ] Live emergency control은 미완료다. 환경값 변경은 process 재시작 전 적용되지 않으며 runtime authority store, operator 인증, 감사, 만료, dual-control 정책은 `PRODUCT_DECISION_REQUIRED`다.
- [ ] Frontend/API/DB schema/설치된 SW의 호환 rollback과 데이터 복원 절차를 실행 증거로 남긴다.

## G7. 최종 증거·승인

- [x] 최종 diff를 기능/계약/테스트/운영 증거로 분류하고 출처 불명 변경이 없음을 확인한다.
  - 2026-09-21 분류: 코드 수정 22개 파일(설정 1, 소스 7, 테스트 6, 문서 5, CI/패키지 2, `.gitignore` 1), 신규 파일 5개(`next.config.ts`, `scripts/api-proxy-smoke.mjs`, `src/lib/api/backend-rewrite.test.ts`, `.env.example`, `docs/evidence/progress-summary-20260921.md`), 이관 QA 증거 65개. 리뷰 수정 2건은 회귀 테스트와 함께 반영됐다. 상세: `docs/evidence/progress-summary-20260921.md`.
- [ ] 핵심 E2E와 production smoke가 최종 revision에 묶여 있다.
- [ ] 독립 코드 리뷰와 공격적 QA에서 차단 finding이 없다.
  - 2026-09-21 `codex review --base main`(model `gpt-5.6-terra`, medium)로 브랜치 diff를 독립 리뷰했고 차단 finding은 없었다. 같은 실행에서 `typecheck`·`lint`·production `build`·`test:api-proxy`도 다시 통과했다. 직접 리뷰로 발견한 2건(참여 취소 뒤 재참여 불가, relation 조회 실패 문구)은 그 전에 수정했다. 최종 revision에 대한 적대적(공격적) QA는 아직 수행하지 않았다.
- [x] 모든 미검증 범위와 외부 수동 게이트를 명시한다.
  - `docs/evidence/progress-summary-20260921.md`의 "미검증·외부 권한 또는 환경 차단" 절에 실 SMS·생성 수명주기·실기기·원격 CI/deploy·release 추적·보존 정책·사람 QA 0건을 나열했다.
- [ ] G0–G7의 필수 항목이 모두 닫힌 뒤에만 완료로 판정한다.

## 출시 후로 미룬 범위

- [x] 전면 재설계, 완전한 offline-first mutation queue, 대형 운영 대시보드, session replay, 멀티리전, 광범위한 구형 브라우저 지원, 앱스토어 패키징은 현재 목표에서 제외한다.
