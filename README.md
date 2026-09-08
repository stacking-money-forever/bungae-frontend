# 벙개 프론트엔드

벙개(Bungae)는 18~39세 성인이 24시간 안에 공개 장소에서 안전하게 만나는 소규모 모임 서비스의 모바일 프론트엔드입니다.

## 현재 구현

- Next.js App Router 참가자 화면. 인증된 요청은 `/v1` API 클라이언트를 사용한다.
- 뷰포트 목표: 최소 320px, 기준 390px, 셸 상한 430px.
- 탐색·내 모임·알림 3탭, 필터, 모임 생성, 참여·대기, 미달 결정, 채팅, 체크인, 피드백, 연결, 알림, 프로필·차단 화면.
- 세션 토큰은 메모리에만 둔다. 새로고침하면 다시 로그인해야 한다.
- 비로그인 화면은 로그인 게이트만 보여 주고, 모임 목록·상세·생성 결과는 서버 응답이 있을 때만 표시한다.

화면 데이터와 상태 변경은 로컬 fixture가 아니라 배포된 `/v1` 계약에 의존한다. 서버가 아직 주지 않는 필드(생성 마감 시각, 참가자 인증 집계, 세션 쿠키, 실시간 연결 상세)는 UI가 추정하지 않는다.

## 실행

```bash
npm ci
npm run dev
```

검증 명령:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

최근 모바일 검증 범위와 남은 제한은 [QA 기록](artifacts/qa/QA_TRANSCRIPT.md)을 따른다.

### 과거 no-API 스냅샷

2026-09-07 no-API 실행 기록(`e126c1fb`, base `cdf1328`)은 당시 fixture/로컬 상태 경계의 증거다. 체크리스트: [`FRONTEND_NO_API_EXECUTION_CHECKLIST.md`](./FRONTEND_NO_API_EXECUTION_CHECKLIST.md). 단계 보고: `.omp-role/reports/frontend-no-api-t01-shell.md` … `frontend-no-api-t07-final.md`. 그 기록의 통과 수와 HEAD 런타임은 같지 않다. 현재 분기는 `review/product-finish-main-20260906`이며 인증 세션은 `/v1`을 호출한다.

## 기준 저장소

- 디자인 원본: [stacking-money-forever/bungae-design](https://github.com/stacking-money-forever/bungae-design)
- 백엔드: [stacking-money-forever/bungae-backend](https://github.com/stacking-money-forever/bungae-backend)

작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.
