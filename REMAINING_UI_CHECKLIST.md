# 벙개 남은 UI 체크리스트
업데이트: 2026-09-07

기준 문서: `PRODUCT_COMPLETION_CHECKLIST.md`와 Notion `번개만남 MVP API 명세서`. 이 문서는 남은 UI 작업만 실행 순서대로 추린다.

## 완료 판정

- [ ] 서버 mutation 성공 전에는 완료·접수·저장·확정 상태를 표시하지 않는다.
- [ ] 서버 DTO에 없는 사용자, 장소, 인원, 상태, 대상 ID를 추측하지 않는다.
- [ ] 인증 계정 또는 route가 바뀌면 이전 요청의 성공·오류·pending·입력이 새 화면에 남지 않는다.
- [ ] 변경 화면마다 loading, empty, error/retry, pending/disabled, 성공, 권한 거절을 적용 가능한 범위에서 검증한다.
- [ ] 관련 Vitest, typecheck, lint, production build, `git diff --check`와 390×844 실제 렌더 검증을 통과한다.

## P0. 가짜 성공·개인정보 화면 제거

- [x] `/meetups/[meetupId]/join` 직접 진입이 참여 완료를 자동 표시하지 않게 한다. 실제 JOIN 결과를 전달받거나 fresh detail에서 상태를 확인할 수 없으면 상세 화면으로 안내한다.
- [x] `/meetups/[meetupId]/waitlist` 직접 진입이 대기 등록 완료·대기 순서를 추측하지 않게 한다. 서버 `JoinResult` 또는 조회 계약이 없으면 결과 화면을 제거하거나 계약 공백을 표시한다.
- [x] `/meetups/[meetupId]/check-in/success` 직접 진입이 체크인 성공을 자동 표시하지 않게 한다. 현재 실제 체크인 페이지의 201 응답 기반 receipt를 단일 성공 표면으로 사용한다.
- [x] `/meetups/[meetupId]/quorum-update`의 local-only 취소·완료 상태를 제거하고 fresh detail 및 실제 cancel/leave 계약으로 교체하거나 route를 폐기한다.
- [x] `/meetups/[meetupId]/attendance`의 local-only 노쇼 이의 접수 완료를 제거한다. 실제 appeal API와 receipt 연결은 P1 구현 대상으로 남긴다.
- [x] `/meetups/[meetupId]/hub`의 fixture 제목·참가자 수·정확한 장소·체크인 가능 시각을 제거한다. Fresh detail에서 허용된 필드와 action만 표시하며 venue redaction을 보존한다.
- [x] 익명 profile/detail/create demo 상태를 production UI에서 제거한다. Query string만으로 서버 생성·참여 성공처럼 보이지 않게 한다.

## P1. 남은 실제 사용자 흐름

### 계정 탈퇴

- [x] `/profile/withdrawal`을 추가하고 profile에서 진입할 수 있게 한다.
- [x] `GET /v1/me/withdrawal`의 예약 없음, `SCHEDULED`, terminal, error/retry 상태를 서버 DTO로 표시한다.
- [x] `POST /v1/me/withdrawal`은 명시적 파괴 확인 뒤 실행하고 202 전 성공을 표시하지 않는다. 동일 재시도는 같은 Idempotency-Key를 사용한다.
- [x] `DELETE /v1/me/withdrawal`은 current version을 `If-Match`로 보내고 204 전 예약을 제거하지 않는다. 409 후 fresh GET을 수행한다.
- [x] 탈퇴 예약·취소가 자동 로그아웃이나 로컬 secret 삭제를 일으키지 않으며 계정 전환 stale completion을 차단한다.

### 노쇼 이의와 신고 결과

- [x] `POST /v1/meetups/{meetupId}/no-show-appeals`에 reason/evidenceIds를 연결하고 201 전 접수 완료를 표시하지 않는다.
- [x] `GET /v1/me/no-show-appeals` 목록과 `GET /v1/me/no-show-appeals/{appealId}` 상세에서 상태·기한·결과를 표시한다.
- [x] `GET /v1/me/incidents`로 내가 제출한 신고의 receipt 이후 처리 상태를 조회한다.
- [x] 적용 가능한 appeal·incident loading/empty/error-retry/cursor/409/account·route stale 상태를 직접 검증한다. Attendance appeal은 pending·2,000자 경계·409·route/account stale success/error와 receipt focus를, appeal 목록은 loading/empty/retry/account stale success/error를, appeal 상세는 loading/retry/route·account stale success/error를, incident 목록은 loading/empty/retry/cursor append·dedupe·append retry·account stale success/error를 검증한다. Cursor는 incident API에만 있고, route parameter는 attendance와 appeal 상세에만 있으며, 409은 appeal mutation에만 적용된다.

### 사후 인상과 다음 행동

- [x] CHECKED_IN 참가자 목록의 실제 `userId`를 대상으로 `/impressions` UI를 만든다. 자기 자신을 제외하고 태그 1–4개, 대상 최대 7명을 검증한다.
- [x] `POST /v1/meetups/{meetupId}/impressions`의 201 전 저장 성공을 금지하고 중복 제출 409를 명확히 표시한다.
- [x] `POST /v1/meetups/{meetupId}/next-intents`에 `SAME_GROUP`, `SAME_ACTIVITY_NEW_PEOPLE`, `DIFFERENT_ACTIVITY` 선택을 연결한다.
- [x] 피드백, 인상, 다음 행동을 서로 독립된 서버 mutation으로 유지하고 하나의 성공이 다른 항목의 성공을 의미하지 않게 한다.

### 연결 상세와 1:1 대화

- [ ] `/connections/[connectionId]`의 reload 가능한 상세 계약을 확정한다. 현재 목록 DTO만으로 상대 이름은 알 수 있지만 단일 connection 조회 계약은 없다.
- [ ] 확정된 `connectionId`로 connection message 목록, send, realtime ticket, SSE/WebSocket 재연결 계약을 연결한다.
- [ ] JWT를 query string에 넣지 않고 ticket transport, 만료, 중복 clientMessageId, reconnect/replay를 검증한다.
- [ ] 연결 상대 신고·차단은 서버가 제공한 counterpart `userId`만 사용하며 local-only 성공을 만들지 않는다.

### 모임 그룹 채팅 실시간 수신

- [ ] 현재 HTTP 목록·전송 이후의 수신 전략을 결정한다. Meetup 전용 realtime 계약을 추가하거나 명시적 새로고침/polling 제품 동작을 확정한다.
- [ ] 확정된 방식으로 새 메시지, 중복, 순서, reconnect, background/foreground 복귀를 검증한다.

## P2. Backend 계약 선행 항목

- [ ] Meetup 상세에 proposer/host `userId` 또는 별도 block-target 계약을 추가한다.
- [ ] 위 계약 이후 상세의 실제 `POST /v1/me/blocks` 흐름을 연결하고 성공 후 접근 차단·목록 반영을 검증한다.
- [ ] Connection 단건 조회 또는 reload 가능한 counterpart 계약을 추가한다.
- [ ] Notification에 제품상 제목·본문·destination이 필요하면 DTO 계약을 추가한다. 추가하지 않으면 현재 type/time/state 최소 UI를 최종안으로 승인한다.
- [ ] 안전한 대략 위치의 정밀도·표현 정책을 결정한다. 결정 전에는 현재처럼 위치를 반환하거나 그리지 않는다.

## P3. 실제 브라우저·실기기 UI 검증

- [ ] 실제 SMS 로그인과 성인·본인 인증 callback 후 주요 flow를 Aside에서 실행한다.
- [ ] 실제 backend 세션으로 생성 → 참가/대기 → 확정/취소 → 채팅 → 체크인 → 피드백/연결을 reload 및 다른 계정에서 검증한다.
- [ ] 390×844에서 다중 bottom action, 긴 한국어 오류, 긴 목록, keyboard open 상태의 clipping·overflow를 캡처한다.
- [ ] 좁은 화면, 200% 확대 글자, keyboard-only focus 순서, Escape/취소 focus 복귀를 검증한다.
- [ ] Reduced Motion, VoiceOver, TalkBack에서 주요 dialog·상태 알림·form label을 검증한다.
- [ ] 실제 HTTPS 설치 모드에서 iOS/Android PWA, offline 재실행, SW update/rollback을 검증한다.
- [ ] Push 등록 → 발송 → foreground/background 수신 → 안전한 내부 이동 → 해제를 검증한다.

## P4. UI 출시 게이트

- [ ] 남은 UI에 fixture/local-only 성공이 없음을 `rg`와 route별 직접 진입으로 확인한다.
- [ ] 핵심 사용자 flow를 최종 revision에 묶인 E2E로 고정한다.
- [ ] Aside 시각 QA와 독립 코드 리뷰의 차단 finding을 모두 닫는다.
- [ ] Preview가 production DB·Push·사용자 데이터에 연결되지 않음을 증명한다.
- [ ] 미지원 기능과 계약 공백이 UI에서 성공·완료로 보이지 않음을 최종 확인한다.
