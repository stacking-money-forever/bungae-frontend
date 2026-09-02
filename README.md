# 벙개 프론트엔드

벙개(Bungae)는 18~39세 성인이 24시간 안에 공개 장소에서 안전하게 만나는 소규모 모임 서비스의 모바일 프론트엔드입니다.

## 현재 구현

- Next.js App Router 기반 참가자 화면 22개
- 390px 모바일 셸과 탐색·내 모임·알림 3탭
- 사진 그리드 탐색, 필터, 모임 생성, 참여·대기, 미달 결정, 채팅, 체크인, 피드백, 연결, 알림, 프로필·차단 화면
- 고정 앱 헤더·하단 액션, 탭 드래그, 화면 스와이프 뒤로가기, Reduced Motion
- 생성 시간 휠, 공개 장소 선택, 입력 검증, 신고·차단 다이얼로그

화면 데이터와 상태 변경은 현재 fixture와 로컬 상태를 사용합니다. 필요한 서버 계약은 [API 계약 제안](docs/API_CONTRACT.md)에 `PROPOSED · NOT IMPLEMENTED` 상태로 정리되어 있습니다.

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
```

최근 모바일 검증 범위와 남은 제한은 [QA 기록](artifacts/qa/QA_TRANSCRIPT.md)을 따릅니다.

## 기준 저장소

- 디자인 원본: [stacking-money-forever/bungae-design](https://github.com/stacking-money-forever/bungae-design)
- 백엔드: [stacking-money-forever/bungae-backend](https://github.com/stacking-money-forever/bungae-backend)

작업 규칙은 [AGENTS.md](AGENTS.md)를 따릅니다.
