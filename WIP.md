# WIP

## 현재 상태

참가자용 모바일 프론트엔드 28개 `page.tsx` 라우트가 구현되어 있다. 인증된 화면은 fixture가 아니라 typed `/v1` API client를 사용하며, 프론트와 백엔드를 분리 실행할 때 Next 서버가 `BUNGAE_API_ORIGIN/api/v1/*`로 전달한다.

공통 앱 셸은 하단 내비게이션·하단 액션, 탭 좌우 드래그, 상세 화면 뒤로가기 제스처를 제공한다. 인증·모임 생성·참가·취소·채팅·체크인·피드백·연결·알림·프로필·신고·차단·탈퇴 화면은 서버 성공 전 완료 상태를 표시하지 않도록 구성되어 있다.

코드와 자동 테스트가 존재한다는 사실은 배포 제품 완료를 의미하지 않는다. 실제 SMS·본인인증 provider, 다계정 전체 사용자 흐름, 실기기 Push/PWA, production 배포·rollback·복원은 계속 미검증이다. [API_CONTRACT.md](docs/API_CONTRACT.md)는 과거 제안과 현재 구현 경계를 함께 보존한 참고 문서이며 live backend 자체의 완료 증거가 아니다.

## 검증 기준선

- 검증 명령의 최신 결과는 현재 revision에서 다시 측정한다. 과거 통과 수를 HEAD 증거로 재사용하지 않는다.
- 2026-09-21 실측: Vitest 72 files / 558 tests, typecheck, lint, build, `test:api-proxy`, Playwright 77/77 통과.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`
- `npm run test:api-proxy`: production Next server의 `/v1` → backend `/api/v1` 전달
- `npm run test:e2e`: API egress를 차단한 익명/셸/PWA 브라우저 회귀
- 실제 backend·DB·외부 provider·실기기 결과는 위 로컬 자동 검증과 별도로 기록한다.

세부 증거는 [artifacts/qa/QA_TRANSCRIPT.md](artifacts/qa/QA_TRANSCRIPT.md)에 있다.

## 남은 확인

- 실제 SMS 수신과 성인·본인인증 callback
- 두 계정 이상으로 생성→참가/대기→확정/취소→채팅→체크인→사후 흐름 및 reload 유지성
- connection 상세·1:1 메시지·realtime/reconnect와 메시지 신고 계약
- 실제 iOS/Android 설치, Push 수신·클릭·해제, VoiceOver/TalkBack
- production CI→deploy→smoke, release 추적, rollback·DB 복원, 데이터 보존·삭제 정책
- Next 16 ESLint flat-config 전환은 미착수 상태다. 2026-09-21 `eslint-config-next@16.3.5`로 실측한 결과 새 React Compiler 규칙 83건(자동 수정 가능 0건, 35개 파일, `react-hooks/refs` 41 / `set-state-in-effect` 24 / `globals` 10 / `immutability` 7 / `purity` 1)이라 릴리스 차단 수정과 분리해야 한다.

커밋과 푸시는 사용자가 명시적으로 요청할 때만 수행한다.
