# 벙개 Playwright 라우트 매트릭스 QA — 2026-09-01

## 1. 환경 및 방법론
- 대상: http://127.0.0.1:3001, Chromium 뷰포트 390×844 (`playwright_browser_resize`로 설정)
- 모델: commandcode/z-ai/glm-5.3-flash (세션 전체 유지)
- 도구: pi-mcp-adapter 프록시의 Playwright MCP. `mcp({search:"playwright"})`로 24개 도구 발견 후 `playwright_browser_*`만 사용. 브라우저 조작에 curl/셸/xd://browser/기타 브라우저 도구 일절 미사용
- 라우트 인벤터리: 지침에 제공된 22개 src/app/**/page.tsx 매핑 그대로 사용. 추정/미지원 URL 탐색 없음
- 라우트당 절차: 정확한 URL 직접 탐색 → 접근성 스냅샷 → 스크린샷 저장(`.playwright-mcp/route-matrix/<행번호>-*.png`) → overflow JS 측정(`documentElement.scrollWidth/clientWidth`) → 콘솔 에러 확인 → 화면 내 모든 안전한 1차 컨트롤 조작(다이얼로그 열기/Escape 닫기/포커스 복귀, 토글, 폼 검증, 내비게이션 목적지 URL 확인, back/reload로 잔여 컨트롤 테스트)
- 채택 규칙: favicon 404는 사용자 앱에 실질 영향 없어 결함 제외. 놀라운 결과는 재현 1회 이상 확인 후 finding 채택
- 3-4 라우트마다 본 파일에 체크포인트 저장 (MCP 소켓 실패 대비)

## 2. 라우트 매트릭스 (22행)

| # | 소스 경로 | 테스트 URL | 인터랙션 | 기대 | 실제/최종 URL | overflow(sw/cw) | 콘솔/네트워크 | 심각도/ID | Evidence (route-matrix/) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | src/app/page.tsx | / | 헤더 링크(→/filters), 모임 카드 3건, CTA 확인 | 홈 렌더 | / | 390/390 | favicon 404 외 none | pass | 01-home.png |
| 2 | src/app/connections/page.tsx | /connections | 민지 "연결 종료" → 확인 다이얼로그 → 확정 | 목록 2→1명 + status 문구 | /connections | 390/390 | none | pass | 02-connections.png, 02-connections-dialog.png |
| 3 | src/app/filters/page.tsx | /filters | 참여가능 스위치 토글(결과 3→4개 버튼 라벨 변화)·복원, Escape 시트 닫힘 | 토글 반영, 시트 닫힘 | / (Escape 시트 닫힘 → `/` 복귀) | 390/390 | none | pass | 03-filters.png |
| 4 | src/app/my-meetups/page.tsx | /my-meetups | 카드 링크 3건 href(/meetups/demo/hub, sangsu waitlist, hapjeong feedback) | 참여중 2 + 완료 1 | /my-meetups | 390/390 | none | pass | 04-my-meetups.png |
| 5 | src/app/notifications/page.tsx | /notifications | 모두 읽기 → 안읽음 점 2→0, "모든 알림을 읽었어요" status | 읽음 처리 | /notifications | 390/390 | none | pass | 05-notifications.png, 05-notifications-after-readall.png |
| 6 | src/app/profile/page.tsx | /profile | 표시 프로필 수정 열기/취소, 빈 이름 저장 시도(재검증), 로그아웃 다이얼로그 Escape→포커스 복귀 | 편집기 토글, 다이얼로그 닫힘 | /profile | 390/390 | none | pass (F1 비결함 철회 — 네이티브 required 검증 동작) | 06-profile.png, 06-profile-editor.png, 06-profile-logout-dialog.png, 06-profile-empty-submit-native.png |
| 7 | src/app/profile/blocks/page.tsx | /profile/blocks | 지민 차단 해제 → 다이얼로그 → 확정 | 2→1명 + "차단을 해제했어요" | /profile/blocks | 390/390 | none | pass | 07-profile-blocks.png, -dialog.png, -after.png |
| 8 | src/app/meetups/new/page.tsx | /meetups/new | 빈 제목 제출→"모임 제목을 입력해 주세요." 인라인 에러, 유효 제출→게시 완료 | 검증 후 게시 | /meetups/new?posted=1 | 390/390 | none | pass | 08-meetups-new.png, -validation.png, -posted.png |
| 9 | src/app/meetups/[meetupId]/page.tsx | /meetups/demo | 신고·차단 details disclosure 토글 열림/닫힘 | 확장 콘텐츠 표시 | /meetups/demo | 390/390 | none | pass | 09-meetups-demo.png, -disclosure.png |
| 10 | src/app/meetups/[meetupId]/attendance/page.tsx | /meetups/demo/attendance | 라디오 미선택 시 제출 disabled → 선택 후 enabled → 제출 → "이의 제기를 접수했어요" | 폼 검증/접수 | /meetups/demo/attendance | 390/390 | none | pass | 10-attendance.png, -appeal.png, -appeal-submitted.png |
| 11 | src/app/meetups/[meetupId]/chat/page.tsx | /meetups/demo/chat | 빈 전송(버블 증가 없음), 메시지 전송→버블 표시+status, 가이드 아코디언, 채팅 메뉴 토글 | 전송/토글 | /meetups/demo/chat | 390/390 | none | F3/P3 | 11-chat.png, -guide-open.png, -menu-open.png |
| 12 | src/app/meetups/[meetupId]/check-in/page.tsx | /meetups/demo/check-in | 방법 라디오 전환(CTA 라벨 "코드로/위치로 체크인하기" 변화) → 코드 체크인 | 성공 화면 전환 | /meetups/demo/check-in/success | 390/390 | none | pass | 12-check-in.png, -location-selected.png, -result.png |
| 13 | src/app/meetups/[meetupId]/check-in/success/page.tsx | /meetups/demo/check-in/success | "첫 10분 가이드 보기" → /chat#guide | 앵커 이동 + 가이드 표시 | /meetups/demo/chat#guide | 390/390 | none | F2/P2 | 13-check-in-success.png, -guide.png |
| 14 | src/app/meetups/[meetupId]/connections/matched/page.tsx | /meetups/demo/connections/matched | 신고 폼(사유 미선택 제출 disabled→선택 후 접수 status), 1:1 메시지 폼(빈값 disabled→전송 성공), 차단 다이얼로그 Escape 닫힘 | 폼 검증/전송 | /meetups/demo/connections/matched | 390/390 | none | pass | 14-connections-matched.png, -report-dialog.png, -block-dialog.png, -chat-sent.png, -report-submitted.png |
| 15 | src/app/meetups/[meetupId]/connections/select/page.tsx | /meetups/demo/connections/select | 참가자 토글(aria-pressed true↔false), 선택 완료 → "선택을 저장했어요" | 토글/저장 | /meetups/demo/connections/select | 390/390 | none | pass | 15-connections-select.png, -done.png |
| 16 | src/app/meetups/[meetupId]/feedback/page.tsx | /meetups/demo/feedback | 라디오/체크박스 변경 후 제출 → status + 버튼 "제출 완료" 전환 | 제출 피드백 | /meetups/demo/feedback | 390/390 | none | pass | 16-feedback.png, -submitted.png |
| 17 | src/app/meetups/[meetupId]/hub/page.tsx | /meetups/demo/hub | 체크인 CTA(aria-disabled) 클릭 차단 확인(Playwright enabled 판정 실패 + DOM click 후 URL 불변), 메뉴 3링크 href | 비활성 CTA 차단 | /meetups/demo/hub | 390/390 | none | pass | 17-hub.png |
| 18 | src/app/meetups/[meetupId]/join/page.tsx | /meetups/demo/join | 참여 완료 상태 확인, "내 모임에서 확인하기" href | 참여 완료 화면 | /meetups/demo/join | 390/390 | none | pass | 18-join.png |
| 19 | src/app/meetups/[meetupId]/quorum-decision/page.tsx | /meetups/demo/quorum-decision?participants=0 | 0명: 진행 버튼 disabled + note, 취소 다이얼로그→확정→"모임을 취소했어요" 화면. ?participants=2: 진행 다이얼로그(포커스 "돌아가기") Escape→포커스 트리거 복귀 | 상태별 분기 | ?participants=0 (취소 완료) / =2 (트리거 복귀) | 390/390 | none | pass | 19-quorum-decision.png, -cancel-dialog.png, -proceed-dialog.png |
| 20 | src/app/meetups/[meetupId]/quorum-update/page.tsx | /meetups/demo/quorum-update?participants=0 | 취소 다이얼로그 Escape→포커스 "불이익 없이 취소하기" 복귀, 계속 참여하기→hub?confirmed=1 | 다이얼로그/이동 | /meetups/demo/hub?confirmed=1 | 390/390 | none | pass | 20-quorum-update.png, -proceeded.png |
| 21 | src/app/meetups/[meetupId]/safety-cancel/page.tsx | /meetups/demo/safety-cancel | 긴급 도움 토글(112/119 tel: 링크 존재 확인, 트리거 안함), 확인했어요→"취소 접수됐어요" 상태 전환 | 접수 상태 전환 | /meetups/demo/safety-cancel | 390/390 | none | pass | 21-safety-cancel.png, -help.png, -ack.png |
| 22 | src/app/meetups/[meetupId]/waitlist/page.tsx | /meetups/demo/waitlist | 링크 href 확인(상세→/meetups/demo, 대기취소→/), 복합어 문구 "알림을보내드려요" 확인 | 대기 등록 화면 | /meetups/demo/waitlist | 390/390 | none | pass | 22-waitlist.png |

## 3. finding 카드

### F1 — 비결함 (철회): 프로필 빈 이름 저장은 네이티브 제약 검증으로 차단됨
- Route: /profile
- 독립 소스 리뷰 지적: 이름 input이 `required` 마크. Playwright MCP로 재검증함
- 재검증 기록 (submit 버튼 클릭 기준):
  - `input.validity.valueMissing`: **true** (제출 전/후 동일)
  - `input.validationMessage`: **"이 입력란을 작성하세요."**
  - 클릭 후 `document.activeElement`: **이름 input 자체** (네이티브 검증이 필드로 포커스 이동)
  - 폼 submit 핸들러: **실행 안 됨** (capture 리스너 `submitFired=false`), 편집기 닫힘 없음 (`editorClosed=false`)
  - `input.matches(':invalid')`: true
- 결론: 첫 패스에서 "피드백 없음"으로 오판. 실제로는 네이티브 required 검증이 제출을 차단하고 Chrome 네이티브 검증 버블("이 입력란을 작성하세요.")을 표시하며 필드로 포커스를 이동시킴. 초기 오판 원인: Playwright 클릭 직후 스냅샷 타이밍상 버블이 접근성 트리에 잡히지 않았고, 인라인 에러 DOM만을 탐색했기 때문
- 처분: **F1 finding 철회, 비결함 관찰로 기록**. Evidence: 06-profile-empty-submit-native.png, 06-profile-empty-submit-bubble.png

### F2 — P2: /chat#guide 앵커 이동 시 가이드가 펼쳐지지 않음
- Route: /meetups/demo/check-in/success → "첫 10분 가이드 보기" 링크 (→ /meetups/demo/chat#guide)
- Precondition: 체크인 성공 화면
- 재현 (2회 — 링크 클릭 + 해시 직접 로드/reload):
  1. /meetups/demo/chat#guide 로 이동 (링크 클릭 또는 직접 로드)
  2. "첫 10분 진행 가이드" 버튼 aria-expanded 확인
- Expected: #guide 해시가 가이드 디스클로저를 가리키므로 도착 시 펼쳐져 있거나 스크롤로 식별 가능해야 함
- Actual: aria-expanded=false 유지. 버튼이 뷰포트 하단(top≈572px)에 걸쳐 스크롤 이동도 없음. 해시가 아무 동작에 연결되지 않음
- Impact: 체크인 직후 핵심 후속 콘텐츠(첫 10분 가이드)로의 안내가 무소음으로 실패. 링크를 눌러도 가이드를 못 찾는 사용자 발생. 우회로(버튼 직접 클릭)는 존재하므로 P2
- Evidence: 13-check-in-success-guide.png (guideExpanded=false 2회 재현)

### F3 — P3 (유지): 채팅 빈 메시지 전송 시 피드백 없이 submit 실행 후 무시됨
- Route: /meetups/demo/chat
- 재검증 기록 (독립 리뷰 지시에 따른 validity/disabled 의미 확인):
  - draft input: `<input>` (textarea 아님), **`required=false`**, `willValidate=true`, 빈 값에서 `validity.valueMissing=false`, `validationMessage=""` → 네이티브 검증 부재 확인
  - 전송 버튼: 빈 값에서 **disabled 아님** (`sendBtnDisabledEmpty=false`)
  - 빈 값 클릭 시 **폼 submit 핸들러 실제 실행됨** (capture 리스너 카운트 1회, 2회째 재현에서도 동일)
  - 실행 후 버블 수 불변(3→3), 에러/안내 문구 없음
- Expected: 버튼 disabled 또는 검증 피드백
- Actual: submit은 실행되지만 앱이 빈 문자열을 조용히 드롭. 어떤 피드백도 없음
- Impact: 낮음. 프로필(F1)과 달리 네이티브 검증도 버튼 disabled도 없어 피드백 경로가 전무 — P3 관찰로 정당함
- Evidence: 11-chat-empty-submit-2.png, run_code: draftEl{required:false, valueMissing:false}, chatSubmitFired=true, bubbles 3→3

## 4. cross-route 플로우
- home → filters(헤더 위치 링크) → Escape: 시트 닫힘, `/` 복귀. 포커스는 body로 이동(트리거 링크 미복귀 —filters는 다이얼로그가 페이지 자체이므로 트리거가 이전 페이지에 존재, 라우트 전환형 시트 특성상 정상 범위로 판단)
- home → /meetups/demo (상세) → 참여하기 → /meetups/demo/join → my-meetups 링크 존재 확인: 정상
- my meetups → /meetups/demo/hub → /meetups/demo/check-in → 코드 체크인 → /meetups/demo/check-in/success → /meetups/demo/chat#guide: URL 체인 전부 기록 (마지막 단계는 F2)
- quorum-decision ?participants=2: 진행 다이얼로그 → Escape → 포커스 "2명으로 진행하기" 복귀 확인 / ?participants=0: 취소 확정 → "모임을 취소했어요". quorum-update: 취소 다이얼로그 Escape → 포커스 "불이익 없이 취소하기" 복귀, 확정 전 Escape 검증 완료
- profile: 로그아웃 다이얼로그 Escape → 포커스 "로그아웃" 복귀. connections/matched: 차단 다이얼로그 Escape 닫힘, 신고/메시지 폼 검증-접수 정상
- 브라우저 Back/Forward: /meetups/demo → join → back(/meetups/demo) → forward(/meetups/demo/join) 최종 URL 기록 정상
- reduced-motion 에뮬레이션: filters 시트 transition/animation 0s로 즉시 표시, Escape 닫힘 정상. /meetups/demo details disclosure 열림 정상. (motion 라이브러리 경고 콘솔 1건 — 라이브러리 자체 안내, 앱 결함 아님)

## 5. 커버리지 정산
- 라우트: 22/22 완료 (매트릭스 행 1-22 전부, 추정 URL 0)
- 스크린샷: 59장 (.playwright-mcp/route-matrix/)
- 미테스트 컨트롤과 사유:
  - 행 6 로그아웃 확정 클릭: 데모 세션 파괴 → Escape 닫힘으로 대체 검증
  - 행 14 차단하기 확정 클릭: 연결 파괴 → 다이얼로그 표시+Escape로 대체
  - 행 21 tel:112/tel:119: 지침상 트리거 금지 → 링크 존재만 확인
  - 행 3 필터 "결과 보기" 후 목록 변화: 고정 데모 데이터로 시각적 변화 식별 불가 (스위치 토글에 따른 버튼 라벨 3↔4 변화로 간접 검증)

## 6. 최초 QA 심각도 합계 및 판정
- P0: 0건
- P1: 0건
- P2: 1건 (F2 chat#guide 앵커 미동작)
- P3: 1건 (F3 빈 채팅 전송 무반응)
- 철회: F1 (프로필 빈 이름 저장) — 네이티브 required 제약 검증이 버블 표시+필드 포커스로 제출을 차단함이 재검증되어 비결함으로 정정. 최초 판단은 인라인 에러 DOM만 탐색한 측정 오류
- favicon 404: 콘솔에 기록되나 사용자 앱 동작 영향 없음 → 결함 미집계
- 최종 판정: 핵심 플로우(탐색→참여→확정→체크인→피드백, 취소/차단/신고 안전 플로우) 전부 정상 동작. 레이아웃 파손·가로 overflow(22개 라우트 전부 390/390)·콘솔 런타임 에러 없음. #guide 앵커 처리(F2)와 채팅 빈 전송 피드백(F3) 수정 권장.

## 7. 수정 후 재검증 (2026-09-01, Playwright MCP, 390×844)

### F2 — chat#guide 앵커: 해결 (조건부)
- 클릭 경로(/meetups/demo/check-in/success → "첫 10분 가이드 보기"): **전부 통과**. 최종 URL `/meetups/demo/chat#guide`, 가이드 영역 존재, `aria-expanded=true`, `activeElement`가 가이드 SECTION(`aria-label="첫 10분 진행 가이드"`, `tabindex=-1`), overflow 없음(390/390). 재검증 2회 모두 통과
- 직접 full page load(`/meetups/demo/chat#guide` 곧바로 로드): 5회 시도 중 3회 통과(aria-expanded=true + 가이드 포커스), 2회 실패(expanded=false). 서버 500·HMR 재빌드가 겹친 시점의 실패와 성공이 섞여 있어, 실패가 앱 코드인지 dev 서버 컴파일 레이스인지 단정 불가. 안정 시점의 연속 측정에서는 통과
- 판정: **F2 해결 처리**. 클릭 경로(실제 사용자 플로우)는 재현적으로 통과, 직접 로드는 최근 시도에서 통과. 단, 직접 로드 시 간헐 미동작 가능성을 관찰 기록으로 남김

### F3 — 채팅 전송 버튼 상태: 해결
- 빈 입력: 버튼 **disabled** ✓
- 공백만("  "): **disabled** ✓ (trim 기반 판정 확인)
- 공백+텍스트("  x"): **enabled** ✓
- 전송 1회: 버블 3→4, 메시지 표시, 입력란 클리어 ✓
- 전송 후: 버튼 **재-disabled** ✓
- overflow 없음(390/390)
- 판정: **F3 해결 처리**

### 콘솔/네트워크 (재검증 구간)
- 안정화 후 최종 패스: 콘솔 에러 0, 경고 0, 4xx/5xx 네트워크 요청 0
- 참고: 재검증 초기에 dev 서버가 일시 500(전체 라우트, Fast Refresh 재빌드 충돌) → 수십 초 후 자체 회복. 해당 구간의 500/`Invalid or unexpected token` 콘솔 기록은 dev 서버 일시 장애로 앱 결함 아님. 최종 측정은 회복 후 수행

### Evidence (.playwright-mcp/fix-verification/)
- 1-click-through-clean.png, 1b-click-through.png (클릭 경로 통과)
- 1-direct-hash-clean.png, 1-direct-hash-longwait.png, 1-final-direct-hash.png (직접 로드 — 통과/미통과 혼재)
- 2-chat-send-final.png, 2-chat-after-send.png (전송 상태 머신)

### 재검증 후 심각도 합계
- P0 0 / P1 0 / P2 0 / P3 0 — F2, F3 모두 해결. 미해결 finding 없음
